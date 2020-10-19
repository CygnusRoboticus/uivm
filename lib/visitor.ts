import { AnyConfig, ArrayConfig, FieldConfig, FormInfoBase, GroupConfig, ItemConfig } from "./configs";
import {
  AbstractFlags,
  ArrayControl,
  FieldControl,
  FieldControlMap,
  GroupControl,
  ItemControl,
  Messages,
} from "./controls";
import { isArrayConfig, isFieldConfig, isGroupConfig, notNullish } from "./utils";
import { ExecutableRegistry } from "./executable";
import { FieldControlType, FieldTypeMap, FormValue } from "./typing";
import { combineLatest, Observable } from "rxjs";
import { map } from "rxjs/operators";

type VK = "value";

export interface Visitor<TFormInfo extends FormInfoBase> {
  itemInit: (
    config: ItemConfig<TFormInfo> & TFormInfo["config"],
    children: ItemControl<TFormInfo["flags"]>[],
  ) => ItemControl<TFormInfo["flags"]>;
  fieldInit: <TValue>(
    config: FieldConfig<TFormInfo> & TFormInfo["config"],
  ) => FieldControl<TValue | null, TFormInfo["flags"]>;
  groupInit: <
    TValue extends { [key in keyof TControls]: TControls[key][VK] },
    TControls extends FieldControlMap<TValue, TFormInfo["flags"]>
  >(
    config: GroupConfig<TFormInfo> & TFormInfo["config"],
    bundled: TControls,
    children: ItemControl<TFormInfo["flags"]>[],
  ) => GroupControl<TValue, typeof bundled, TFormInfo["flags"]>;
  arrayInit: <
    TValue extends { [key in keyof TControls]: TControls[key][VK] },
    TControls extends FieldControlMap<TValue, TFormInfo["flags"]>
  >(
    config: ArrayConfig<TFormInfo> & TFormInfo["config"],
    bundled: TControls,
  ) => ArrayControl<TValue, GroupControl<TValue, TControls, TFormInfo["flags"]>, TControls, TFormInfo["flags"]>;

  itemComplete: <TRootValue>(
    control: ItemControl<TFormInfo["flags"]>,
    config: ItemConfig<TFormInfo> & TFormInfo["config"],
    root: GroupControl<TRootValue, any, TFormInfo["flags"]>,
    registry: TFormInfo["registry"],
  ) => void;
  fieldComplete: <TValue, TRootValue>(
    control: FieldControl<TValue | null, TFormInfo["flags"]>,
    config: FieldConfig<TFormInfo> & TFormInfo["config"],
    root: GroupControl<TRootValue, any, TFormInfo["flags"]>,
    registry: TFormInfo["registry"],
  ) => void;
  groupComplete: <TValue, TRootValue>(
    control: GroupControl<TValue, any, TFormInfo["flags"]>,
    config: GroupConfig<TFormInfo>,
    root: GroupControl<TRootValue, any, TFormInfo["flags"]>,
    registry: TFormInfo["registry"],
  ) => void;
  arrayComplete: <
    TValue extends { [key in keyof TControls]: TControls[key]["value"] },
    TRootValue,
    TControls extends FieldControlMap<TValue, TFormInfo["flags"]>
  >(
    control: ArrayControl<TValue, GroupControl<TValue, TControls, TFormInfo["flags"]>, TControls, TFormInfo["flags"]>,
    config: ArrayConfig<TFormInfo>,
    root: GroupControl<TRootValue, any, TFormInfo["flags"]>,
    registry: TFormInfo["registry"],
  ) => void;
}

class DefaultVisitor<TFormInfo extends FormInfoBase> implements Visitor<TFormInfo> {
  itemInit(config: ItemConfig<TFormInfo> & TFormInfo["config"], children: ItemControl<TFormInfo["flags"]>[]) {
    return new ItemControl<TFormInfo["flags"]>(children);
  }
  fieldInit<TValue>(config: FieldConfig<TFormInfo> & TFormInfo["config"]) {
    return new FieldControl<TValue | null, TFormInfo["flags"]>(null);
  }
  groupInit<
    TValue extends { [key in keyof TControls]: TControls[key][VK] },
    TControls extends FieldControlMap<TValue, TFormInfo["flags"]>
  >(
    config: GroupConfig<TFormInfo> & TFormInfo["config"],
    bundled: TControls,
    children: ItemControl<TFormInfo["flags"]>[],
  ) {
    return new GroupControl<TValue, TControls, TFormInfo["flags"]>(bundled, children);
  }
  arrayInit<
    TValue extends { [key in keyof TControls]: TControls[key][VK] },
    TItem extends GroupControl<TValue, TControls, TFormInfo["flags"]>,
    TControls extends FieldControlMap<TValue, TFormInfo["flags"]>
    // TODO: unsure what this type is actually complaining about
  >(config: ArrayConfig<TFormInfo> & TFormInfo["config"], bundled: TControls) {
    return new ArrayControl<TValue, TItem, TControls, TFormInfo["flags"]>(
      () => new GroupControl<TValue, TControls, TFormInfo["flags"]>(bundled) as TItem,
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
  fieldComplete<TValue>(
    control: FieldControl<TValue | null, TFormInfo["flags"]>,
    config: FieldConfig<TFormInfo> & TFormInfo["config"],
    _: GroupControl<any, any, TFormInfo["flags"]>,
    registry: TFormInfo["registry"],
  ) {
    this.initItem(control, config as any, registry);
  }
  groupComplete<
    TConfig extends ItemConfig<TFormInfo>,
    TValue extends { [key in keyof TControls]: TControls[key]["value"] },
    TControls extends FieldControlMap<TValue, TFormInfo["flags"]>
  >(
    control: GroupControl<TValue, TControls, TFormInfo["flags"]>,
    config: GroupConfig<TFormInfo> & TFormInfo["config"],
    _: GroupControl<any, any, TFormInfo["flags"]>,
    registry: TFormInfo["registry"],
  ) {
    this.initItem(control, config as any, registry);
  }
  arrayComplete<
    TValue extends { [key in keyof TControls]: TControls[key]["value"] },
    TItem extends GroupControl<TValue, TControls, TFormInfo["flags"]>,
    TControls extends FieldControlMap<TValue, TFormInfo["flags"]>
  >(
    control: ArrayControl<TValue, TItem, TControls, TFormInfo["flags"]>,
    // TODO: as above, this type is complaining for mysterious reasons
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

  initField<TValue>(
    control: FieldControl<TValue, TFormInfo["flags"]>,
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
  TFormInfo extends FormInfoBase,
  TConfig extends GroupConfig<TFormInfo> & FieldConfig<TFormInfo> & TFormInfo["config"],
  TValue = never
>(config: TConfig, registry: TFormInfo["registry"], visitor: Visitor<TFormInfo> = new DefaultVisitor<TFormInfo>()) {
  type TValue2 = [TValue] extends [never]
    ? FormValue<TConfig["fields"], FieldTypeMap<TFormInfo["config"], never, never, never, never, never>>
    : TValue;

  const bundle = bundleConfig2<TFormInfo, TValue2>(config, visitor) as ConfigBundle<
    GroupControl<TValue2, FieldControlMap<TValue2, TFormInfo["flags"]>, TFormInfo["flags"]>,
    typeof config,
    TFormInfo
  >;
  completeConfig2(bundle, registry, bundle, visitor);
  return bundle;
}

function completeConfig2<
  TFormInfo extends FormInfoBase,
  TValue = FormValue<TFormInfo["config"][], FieldTypeMap<TFormInfo["config"], never, never, never, never, never>>
>(
  bundle: ConfigBundle<
    GroupControl<TValue, FieldControlMap<TValue, TFormInfo["flags"]>, TFormInfo["flags"]>,
    TFormInfo["config"],
    TFormInfo
  >,
  registry: TFormInfo["registry"],
  rootBundle: ConfigBundle<
    GroupControl<TValue, FieldControlMap<TValue, TFormInfo["flags"]>, TFormInfo["flags"]>,
    TFormInfo["config"],
    TFormInfo
  >,
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
    visitor.fieldComplete(control as any, config as any, rootBundle.control, registry);
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
            ...(bundle.control as GroupControl<TValue, FieldControlMap<TValue, TFormInfo["flags"]>, TFormInfo["flags"]>)
              .controls,
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
      {} as FieldControlMap<TValue, TFormInfo["flags"]>,
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
