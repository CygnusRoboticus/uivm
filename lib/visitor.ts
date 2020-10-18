import { ArrayConfig, FieldConfig, GroupConfig, ItemConfig } from "./configs";
import { AbstractFlags, ArrayControl, FieldControl, FieldControlMap, GroupControl, ItemControl } from "./controls";
import { isArrayConfig, isFieldConfig, isGroupConfig } from "./utils";
import { ExecutableRegistry } from "./executable";
import { FieldTypeMap, FormValue } from "./typing";

type VK = "value";

export interface Visitor<
  TConfig extends ItemConfig<TRegistry, TFlags>,
  TRegistry extends ExecutableRegistry,
  TFlags extends AbstractFlags
> {
  itemInit: (config: TConfig) => ItemControl<TFlags>;
  fieldInit: <TValue>(config: FieldConfig<TRegistry, TFlags>) => FieldControl<TValue | null, TFlags>;
  groupInit: <
    TValue extends { [key in keyof TControls]: TControls[key][VK] },
    TControls extends FieldControlMap<TValue, TFlags>
  >(
    config: GroupConfig<TConfig, TRegistry, TFlags>,
    bundled: TControls,
  ) => GroupControl<TValue, typeof bundled, TFlags>;
  arrayInit: <
    TValue extends { [key in keyof TControls]: TControls[key][VK] },
    TControls extends FieldControlMap<TValue, TFlags>
  >(
    config: ArrayConfig<TConfig, TRegistry, TFlags>,
    bundled: TControls,
  ) => ArrayControl<TValue, GroupControl<TValue, TControls, TFlags>, TControls, TFlags>;

  itemComplete: <TRootValue>(
    control: ItemControl<TFlags>,
    config: TConfig,
    root: GroupControl<TRootValue, any, TFlags>,
  ) => void;
  fieldComplete: <TValue, TRootValue>(
    control: FieldControl<TValue | null, TFlags>,
    config: FieldConfig<TRegistry, TFlags>,
    root: GroupControl<TRootValue, any, TFlags>,
  ) => void;
  groupComplete: <TValue, TRootValue>(
    control: GroupControl<TValue, any, TFlags>,
    config: GroupConfig<TConfig, TRegistry, TFlags>,
    root: GroupControl<TRootValue, any, TFlags>,
  ) => void;
  arrayComplete: <
    TValue extends { [key in keyof TControls]: TControls[key]["value"] },
    TRootValue,
    TControls extends FieldControlMap<TValue, TFlags>
  >(
    control: ArrayControl<TValue, GroupControl<TValue, TControls, TFlags>, TControls, TFlags>,
    config: ArrayConfig<TConfig, TRegistry, TFlags>,
    root: GroupControl<TRootValue, any, TFlags>,
  ) => void;
}

class DefaultVisitor<
  TConfig extends ItemConfig<TRegistry, TFlags>,
  TRegistry extends ExecutableRegistry = ExecutableRegistry,
  TFlags extends AbstractFlags = AbstractFlags
> implements Visitor<TConfig, TRegistry, TFlags> {
  itemInit(config: TConfig) {
    return new ItemControl<TFlags>();
  }
  fieldInit<TValue>(config: FieldConfig<TRegistry, TFlags>) {
    return new FieldControl<TValue | null, TFlags>(null);
  }
  groupInit<
    TConfig extends ItemConfig<TRegistry, TFlags>,
    TValue extends { [key in keyof TControls]: TControls[key][VK] },
    TControls extends FieldControlMap<TValue, TFlags>
  >(config: GroupConfig<TConfig, TRegistry, TFlags>, bundled: TControls) {
    return new GroupControl<TValue, TControls, TFlags>(bundled);
  }
  arrayInit<
    TValue extends { [key in keyof TControls]: TControls[key][VK] },
    TItem extends GroupControl<TValue, TControls, TFlags>,
    TFlags extends AbstractFlags,
    TControls extends FieldControlMap<TValue, TFlags>
    // TODO: unsure what this type is actually complaining about
  >(config: ArrayConfig<TConfig & ItemConfig<TRegistry, TFlags>, TRegistry, TFlags>, bundled: TControls) {
    return new ArrayControl<TValue, TItem, TControls, TFlags>(
      () => new GroupControl<TValue, TControls, TFlags>(bundled) as TItem,
    );
  }

  itemComplete(control: ItemControl<TFlags>, config: TConfig) {
    const executors = config;
    // control.setFlagExecutors();
  }
  fieldComplete<TValue>(control: FieldControl<TValue | null, TFlags>) {}
  groupComplete<
    TConfig extends ItemConfig<TRegistry, TFlags>,
    TValue extends { [key in keyof TControls]: TControls[key]["value"] },
    TControls extends FieldControlMap<TValue, TFlags>
  >(control: GroupControl<TValue, TControls, TFlags>) {}
  arrayComplete<
    TValue extends { [key in keyof TControls]: TControls[key]["value"] },
    TItem extends GroupControl<TValue, TControls, TFlags>,
    TFlags extends AbstractFlags,
    TControls extends FieldControlMap<TValue, TFlags>
  >(control: ArrayControl<TValue, TItem, TControls, TFlags>) {}
}

export function bundleConfig<
  TConfig extends ItemConfig<TRegistry, TFlags>,
  TValue = FormValue<TConfig[], FieldTypeMap<TConfig, never, never, never, never, never>>,
  TRegistry extends ExecutableRegistry = ExecutableRegistry,
  TFlags extends AbstractFlags = AbstractFlags
>(
  config: TConfig,
  visitor: Visitor<TConfig, TRegistry, TFlags> = new DefaultVisitor<TConfig, TRegistry, TFlags>(),
): {
  control: GroupControl<TValue, FieldControlMap<TValue, TFlags>, TFlags>;
  items: ItemControl<TFlags>[];
} {
  const rootConfig: GroupConfig<TConfig, TRegistry, TFlags> & FieldConfig<TRegistry, TFlags> = {
    name: "bundle",
    type: "group",
    fields: [config],
  };
  const bundle = bundleConfig2<TConfig, TValue, TRegistry, TFlags>((rootConfig as unknown) as TConfig, visitor);
  return {
    control: bundle.control as GroupControl<TValue, FieldControlMap<TValue, TFlags>, TFlags>,
    items: bundle.items,
  };
}

function bundleConfig2<
  TConfig extends ItemConfig<TRegistry, TFlags>,
  TValue,
  TRegistry extends ExecutableRegistry,
  TFlags extends AbstractFlags
>(
  config: TConfig,
  visitor: Visitor<TConfig, TRegistry, TFlags> = new DefaultVisitor<TConfig, TRegistry, TFlags>(),
): {
  control: FieldControl<TValue | null, TFlags> | null;
  items: ItemControl<TFlags>[];
} {
  const items: ItemControl<TFlags>[] = [];
  if (isGroupConfig<TConfig>(config)) {
    const bundled = config.fields
      .map(f => {
        if (isFieldConfig(f)) {
          const bundle = bundleConfig2<TConfig, TValue[keyof TValue], TRegistry, TFlags>(
            (f as unknown) as TConfig,
            visitor,
          );
          items.push(...bundle.items);
          return { [f.name]: bundle.control };
        } else if (isGroupConfig<TConfig>(f)) {
          const bundle = bundleConfig2<TConfig, TValue, TRegistry, TFlags>(
            ({ ...f, name: "group" } as unknown) as TConfig,
            visitor,
          );
          items.push(...bundle.items);
          return { ...(bundle.control as GroupControl<TValue, any, any>).controls };
        }
        const bundle = bundleConfig2<TConfig, TValue, TRegistry, TFlags>((f as unknown) as TConfig, visitor);
        items.push(...bundle.items);
        return null;
      })
      .filter(Boolean)
      .reduce((acc, f) => ({ ...acc, ...f }), {} as FieldControlMap<TValue, TFlags>);

    if (isArrayConfig<TConfig>(config)) {
      const control = visitor.arrayInit(config, bundled) as any;
      return { control, items };
    } else if (isFieldConfig(config)) {
      const control = visitor.groupInit(config, bundled) as any;
      return { control, items };
    }
  } else if (isFieldConfig(config)) {
    const control = visitor.fieldInit<TValue | null>(config);
    return { control, items };
  }

  const item = visitor.itemInit(config);
  items.push(item);
  return { control: null, items };
}
