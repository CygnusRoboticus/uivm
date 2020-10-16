import {
  ArrayConfig,
  FieldConfig,
  GroupConfig,
  isArrayConfig,
  isFieldConfig,
  isGroupConfig,
  ItemConfig,
} from "./configs";
import {
  AbstractFlags,
  ArrayControl,
  FieldControl,
  FieldControlMap,
  GroupControl,
  GroupValue,
  ItemControl,
} from "./controls";

interface Visitor<TConfig extends ItemConfig, TFlags extends AbstractFlags> {
  item: (config: TConfig) => ItemControl<TFlags>;
  field: <TValue>(config: FieldConfig<TValue>) => FieldControl<TValue | null, TFlags>;
  group: <TValue>(
    config: GroupConfig<TConfig>,
    bundled: FieldControlMap<TValue, TFlags>,
  ) => GroupControl<TValue, typeof bundled, TFlags>;
  array: <TValue>(
    config: ArrayConfig<TValue, TConfig>,
    bundled: FieldControlMap<TValue, TFlags>,
  ) => ArrayControl<TValue, GroupControl<TValue, typeof bundled, TFlags>, TFlags, typeof bundled>;
}

class DefaultVisitor<TConfig extends ItemConfig, TFlags extends AbstractFlags> implements Visitor<TConfig, TFlags> {
  item(config: TConfig) {
    return new ItemControl<TFlags>();
  }
  field<TValue>(config: FieldConfig<TValue>) {
    return new FieldControl<TValue | null, TFlags>(config.defaultValue ?? null);
  }
  group<
    TConfig extends ItemConfig,
    TValue extends GroupValue<TValue, TControls, TFlags>,
    TControls extends FieldControlMap<TValue, TFlags>
  >(config: GroupConfig<TConfig>, bundled: TControls) {
    return new GroupControl<TValue, TControls, TFlags>(bundled);
  }
  array<
    TValue extends GroupValue<TValue, TControls, TFlags>,
    TItem extends GroupControl<TValue, TControls, TFlags>,
    TFlags extends AbstractFlags,
    TControls extends FieldControlMap<TValue, TFlags>
  >(config: ArrayConfig<TValue, TConfig>, bundled: TControls) {
    return new ArrayControl<TValue, TItem, TFlags, TControls>(
      () => new GroupControl<TValue, TControls, TFlags>(bundled) as TItem,
    );
  }
}

export function bundleConfig<TConfig extends ItemConfig, TValue, TFlags extends AbstractFlags>(
  config: TConfig,
  visitor: Visitor<TConfig, TFlags> = new DefaultVisitor<TConfig, TFlags>(),
): {
  control: GroupControl<TValue, FieldControlMap<TValue, TFlags>, TFlags>;
  items: ItemControl<TFlags>[];
} {
  const bundle = bundleConfig2<TConfig, TValue, TFlags>(
    ({ name: "bundle", fields: [config] } as unknown) as TConfig,
    visitor,
  );
  return {
    control: bundle.control as GroupControl<TValue, FieldControlMap<TValue, TFlags>, TFlags>,
    items: bundle.items,
  };
}

function bundleConfig2<TConfig extends ItemConfig, TValue, TFlags extends AbstractFlags>(
  config: TConfig,
  visitor: Visitor<TConfig, TFlags> = new DefaultVisitor<TConfig, TFlags>(),
): {
  control: FieldControl<TValue | null, TFlags> | null;
  items: ItemControl<TFlags>[];
} {
  const items: ItemControl<TFlags>[] = [];
  if (isGroupConfig<TConfig>(config)) {
    const bundled = config.fields
      .filter<FieldConfig<TValue>>(isFieldConfig)
      .map(f => {
        const bundle = bundleConfig<TConfig, TValue, TFlags>((f as unknown) as TConfig, visitor);
        items.push(...bundle.items);
        return bundle.control ? { [f.name]: bundle.control } : null;
      })
      .filter(Boolean)
      .reduce((acc, f) => ({ ...acc, ...f }), {} as FieldControlMap<TValue, TFlags>);

    if (isArrayConfig<TConfig, TValue>(config)) {
      const control = visitor.array<TValue>(config, bundled) as any;
      return { control, items };
    } else if (isFieldConfig<TValue>(config)) {
      const control = visitor.group<TValue>(config, bundled) as any;
      return { control, items };
    }
  } else if (isFieldConfig<TValue | null>(config)) {
    const control = visitor.field<TValue | null>(config);
    return { control, items };
  }

  const item = visitor.item(config);
  items.push(item);
  return { control: null, items };
}
