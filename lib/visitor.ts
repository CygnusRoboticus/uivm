import { combineLatest, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { ArrayConfig, FieldConfig, FormInfoBase, GroupConfig, ItemConfig } from "./configs";
import { ArrayControl, FieldControl, GroupControl, ItemControl, KeyValueControls, Messages } from "./controls";
import { isArrayConfig, isFieldConfig, isGroupConfig } from "./utils";

export interface Visitor<TFormInfo extends FormInfoBase> {
  itemInit: (
    config: ItemConfig<TFormInfo> & TFormInfo["config"],
    children: ItemControl<TFormInfo["flags"]>[],
  ) => ItemControl<TFormInfo["flags"]>;
  fieldInit: (config: FieldConfig<TFormInfo> & TFormInfo["config"]) => FieldControl<any, TFormInfo["flags"]>;
  groupInit: (
    config: GroupConfig<TFormInfo> & TFormInfo["config"],
    bundled: KeyValueControls<any, TFormInfo["flags"]>,
    children: ItemControl<TFormInfo["flags"]>[],
  ) => GroupControl<any, any, TFormInfo["flags"]>;
  arrayInit: (
    config: ArrayConfig<TFormInfo> & TFormInfo["config"],
    bundled: KeyValueControls<any, TFormInfo["flags"]>,
  ) => ArrayControl<any, any, TFormInfo["flags"]>;

  itemComplete: (
    control: ItemControl<TFormInfo["flags"]>,
    config: ItemConfig<TFormInfo> & TFormInfo["config"],
    root: GroupControl<any, any, TFormInfo["flags"]>,
    registry: TFormInfo["registry"],
  ) => void;
  fieldComplete: (
    control: FieldControl<any, TFormInfo["flags"]>,
    config: FieldConfig<TFormInfo> & TFormInfo["config"],
    root: GroupControl<any, any, TFormInfo["flags"]>,
    registry: TFormInfo["registry"],
  ) => void;
  groupComplete: (
    control: GroupControl<any, any, TFormInfo["flags"]>,
    config: GroupConfig<TFormInfo>,
    root: GroupControl<any, any, TFormInfo["flags"]>,
    registry: TFormInfo["registry"],
  ) => void;
  arrayComplete: (
    control: ArrayControl<any, any, TFormInfo["flags"]>,
    config: ArrayConfig<TFormInfo>,
    root: GroupControl<any, any, TFormInfo["flags"]>,
    registry: TFormInfo["registry"],
  ) => void;
}

class DefaultVisitor<TFormInfo extends FormInfoBase> implements Visitor<TFormInfo> {
  itemInit(config: ItemConfig<TFormInfo> & TFormInfo["config"]) {
    return new ItemControl<TFormInfo["flags"]>();
  }
  fieldInit(config: FieldConfig<TFormInfo> & TFormInfo["config"]) {
    return new FieldControl<any, TFormInfo["flags"]>(null);
  }
  groupInit(config: GroupConfig<TFormInfo> & TFormInfo["config"], bundled: KeyValueControls<any, TFormInfo["flags"]>) {
    return new GroupControl<any, any, TFormInfo["flags"]>(bundled);
  }
  arrayInit(config: ArrayConfig<TFormInfo> & TFormInfo["config"], bundled: KeyValueControls<any, TFormInfo["flags"]>) {
    return new ArrayControl<any, any, TFormInfo["flags"]>(
      () => new GroupControl<any, any, TFormInfo["flags"]>(bundled),
    );
  }

  itemComplete(
    control: ItemControl<TFormInfo["flags"]>,
    config: ItemConfig<TFormInfo> & TFormInfo["config"],
    _: GroupControl<any, any, TFormInfo["flags"]>,
    registry: TFormInfo["registry"],
  ) {
    this.initItem(control, config, registry);
  }
  fieldComplete(
    control: FieldControl<any, TFormInfo["flags"]>,
    config: FieldConfig<TFormInfo> & TFormInfo["config"],
    _: GroupControl<any, any, TFormInfo["flags"]>,
    registry: TFormInfo["registry"],
  ) {
    this.initItem(control, config, registry);
  }
  groupComplete(
    control: GroupControl<any, any, TFormInfo["flags"]>,
    config: GroupConfig<TFormInfo> & TFormInfo["config"],
    _: GroupControl<any, any, TFormInfo["flags"]>,
    registry: TFormInfo["registry"],
  ) {
    this.initItem(control, config, registry);
  }
  arrayComplete(
    control: ArrayControl<any, any, TFormInfo["flags"]>,
    config: GroupConfig<TFormInfo> & TFormInfo["config"],
    _: GroupControl<any, any, TFormInfo["flags"]>,
    registry: TFormInfo["registry"],
  ) {
    this.initItem(control as any, config as any, registry);
  }

  initItem(control: ItemControl<TFormInfo["flags"]>, config: ItemConfig<TFormInfo>, registry: TFormInfo["registry"]) {
    const flags = Object.entries(config.flags ?? {}).map(([key, value]) => {
      const sources = value.map(f => {
        const method = (registry.flags as any)?.[f.name]?.bind(registry.flags);
        return method(control, (f as any).params, config) as Observable<boolean>;
      });
      return combineLatest(sources).pipe(map(f => <[keyof TFormInfo["flags"], boolean]>[key, f.some(Boolean)]));
    });

    const messages = (config.messagers ?? []).map(m => {
      const method = (registry.messagers as any)?.[m.name]?.bind(registry.messagers);
      return method(control, (m as any).params, config) as Observable<Messages | null>;
    });

    const triggers = (config.triggers ?? []).map(t => {
      const method = (registry.triggers as any)?.[t.name]?.bind(registry.triggers);
      return method(control, (t as any).params, config) as Observable<void>;
    });

    control.setFlagExecutors(flags);
    control.setMessageExecutors(messages);
    control.setTriggerExecutors(triggers);
  }

  initField(
    control: FieldControl<any, TFormInfo["flags"]>,
    config: FieldConfig<TFormInfo>,
    registry: TFormInfo["registry"],
  ) {
    const disablers = (config.disablers ?? []).map(f => {
      // @ts-ignore
      const method = registry.disablers?.[f.name]?.bind(registry.messagers);
      // @ts-ignore
      return method(control, f.params, config) as Observable<boolean>;
    });

    control.setDisableExecutors(disablers);
  }
}

export interface ConfigBundle<
  TControl extends ItemControl<TFormInfo["flags"]>,
  TConfig extends TFormInfo["config"],
  TFormInfo extends FormInfoBase
> {
  control: TControl;
  config: TConfig;
  children: ConfigBundle<TControl, TConfig, TFormInfo>[];
}

export function bundleConfig<
  TConfig extends GroupConfig<TFormInfo> & FieldConfig<TFormInfo> & TFormInfo["config"],
  TFormInfo extends FormInfoBase,
  TValue = never
>(config: TConfig, registry: TFormInfo["registry"], visitor: Visitor<TFormInfo> = new DefaultVisitor<TFormInfo>()) {
  const bundle = bundleConfig2<TFormInfo, TValue>(config, visitor) as ConfigBundle<
    GroupControl<TValue, any, TFormInfo["flags"]>,
    typeof config,
    TFormInfo
  >;
  completeConfig2(bundle, registry, bundle, visitor);
  return bundle;
}

function completeConfig2<TFormInfo extends FormInfoBase>(
  bundle: ConfigBundle<GroupControl<any, any, TFormInfo["flags"]>, TFormInfo["config"], TFormInfo>,
  registry: TFormInfo["registry"],
  rootBundle: ConfigBundle<GroupControl<any, any, TFormInfo["flags"]>, TFormInfo["config"], TFormInfo>,
  visitor: Visitor<TFormInfo>,
) {
  const { config, control, children } = bundle;
  children.forEach(c => completeConfig2(c, registry, rootBundle, visitor));

  if (isFieldConfig<TFormInfo["config"]>(config)) {
    if (isArrayConfig<TFormInfo["config"]>(config)) {
      visitor.arrayComplete(control as any, config as any, rootBundle.control, registry);
    } else if (isGroupConfig<TFormInfo["config"]>(config)) {
      visitor.groupComplete(control, config as any, rootBundle.control, registry);
    }
    visitor.fieldComplete(control, config as any, rootBundle.control, registry);
  }
  visitor.itemComplete(control, config as any, rootBundle.control, registry);
}

function bundleConfig2<TFormInfo extends FormInfoBase, TValue>(
  config: TFormInfo["config"],
  visitor: Visitor<TFormInfo>,
): ConfigBundle<ItemControl<TFormInfo["flags"]>, typeof config, TFormInfo> {
  if (isGroupConfig<TFormInfo["config"]>(config)) {
    const items = config.fields.map(f => {
      if (isFieldConfig<TFormInfo["config"]>(f)) {
        const bundle = bundleConfig2<TFormInfo, TValue[keyof TValue]>(f, visitor);
        return { controls: { [f.name]: bundle.control }, config: f, items: [bundle] };
      } else if (isGroupConfig<TFormInfo["config"]>(f)) {
        const bundle = bundleConfig2<TFormInfo, TValue>({ ...f, name: "group" }, visitor);
        return {
          controls: {
            ...(bundle.control as GroupControl<any, any, TFormInfo["flags"]>).controls,
          },
          config: f,
          items: [bundle],
        };
      }
      const bundle = bundleConfig2<TFormInfo, TValue>(f, visitor);
      return { controls: {}, config: f, items: [bundle] };
    });

    const controls = items.reduce(
      (acc, f) => ({ ...acc, ...f.controls }),
      {} as KeyValueControls<TValue, TFormInfo["flags"]>,
    );
    const children = items.reduce((acc, f) => [...acc, ...f.items], <typeof items[0]["items"]>[]);

    if (isArrayConfig<TFormInfo["config"]>(config)) {
      const control = visitor.arrayInit(config as any, controls);
      return { config, control, children };
    } else if (isFieldConfig<TFormInfo["config"]>(config)) {
      const control = visitor.groupInit(
        config as any,
        controls,
        children.map(c => c.control),
      );
      return { config, control, children };
    } else {
      const control = visitor.itemInit(
        config as any,
        children.map(c => c.control),
      );
      return { config, control, children };
    }
  } else if (isFieldConfig<TFormInfo["config"]>(config)) {
    const control = visitor.fieldInit(config as any);
    return { config, control, children: [] };
  }

  const control = visitor.itemInit(config as any, []);
  return { config, control, children: [] };
}
