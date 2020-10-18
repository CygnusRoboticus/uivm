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
        // @ts-ignore
        const method = registry.flags[f.name]?.bind(registry.flags);
        // @ts-ignore
        return method(control, f.params, config) as Observable<boolean>;
      });
      return combineLatest(sources).pipe(map(f => <[keyof TFormInfo["flags"], boolean]>[key, f.some(Boolean)]));
    });
    const messages = (config.messagers ?? []).map(m => {
      // @ts-ignore
      const method = registry.messagers[m.name]?.bind(registry.messagers);
      // @ts-ignore
      return method(control, m.params, config) as Observable<Messages | null>;
    });

    control.setFlagExecutors(flags);
    control.setMessageExecutors(messages);
  }

  initField<TValue>(
    control: FieldControl<TValue, TFormInfo["flags"]>,
    config: FieldConfig<TFormInfo>,
    registry: TFormInfo["registry"],
  ) {
    const disablers = (config.disablers ?? []).map(f => {
      // @ts-ignore
      const method = registry.disablers[f.name]?.bind(registry.messagers);
      // @ts-ignore
      return method(control, f.params, config) as Observable<boolean>;
    });

    control.setDisableExecutors(disablers);
  }
}

export function bundleConfig<
  TFormInfo extends FormInfoBase,
  TValue = FormValue<TFormInfo["config"][], FieldTypeMap<TFormInfo["config"], never, never, never, never, never>>
>(
  config: GroupConfig<TFormInfo> & FieldConfig<TFormInfo> & TFormInfo["config"],
  visitor: Visitor<TFormInfo> = new DefaultVisitor<TFormInfo>(),
): GroupControl<TValue, FieldControlMap<TValue, TFormInfo["flags"]>, TFormInfo["flags"]> {
  const bundle = bundleConfig2<TFormInfo, TValue>(config, visitor) as GroupControl<
    TValue,
    FieldControlMap<TValue, TFormInfo["flags"]>,
    TFormInfo["flags"]
  >;
  completeConfig2(bundle, visitor);
  return bundle;
}

function completeConfig2<
  TFormInfo extends FormInfoBase,
  TValue = FormValue<TFormInfo["config"][], FieldTypeMap<TFormInfo["config"], never, never, never, never, never>>
>(
  bundle: GroupControl<TValue, FieldControlMap<TValue, TFormInfo["flags"]>, TFormInfo["flags"]>,
  visitor: Visitor<TFormInfo>,
) {
  // noop right now
}

function bundleConfig2<TFormInfo extends FormInfoBase, TValue>(
  config: TFormInfo["config"],
  visitor: Visitor<TFormInfo>,
): ItemControl<TFormInfo["flags"]> {
  if (isGroupConfig<TFormInfo["config"]>(config)) {
    const items = config.fields.map(f => {
      if (isFieldConfig<TFormInfo["config"]>(f)) {
        const bundle = bundleConfig2<TFormInfo, TValue[keyof TValue]>(f, visitor);
        return { controls: { [f.name]: bundle }, items: [bundle] };
      } else if (isGroupConfig<TFormInfo["config"]>(f)) {
        const bundle = bundleConfig2<TFormInfo, TValue>({ ...f, name: "group" }, visitor) as GroupControl<
          TValue,
          FieldControlMap<TValue, TFormInfo["flags"]>,
          TFormInfo["flags"]
        >;
        return { controls: { ...bundle.controls }, items: [bundle] };
      }
      const bundle = bundleConfig2<TFormInfo, TValue>(f, visitor);
      return { controls: {}, items: [bundle] };
    });

    const controls = items.reduce(
      (acc, f) => ({ ...acc, ...f.controls }),
      {} as FieldControlMap<TValue, TFormInfo["flags"]>,
    );
    const children = items.reduce((acc, f) => [...acc, ...f.items], <typeof items[0]["items"]>[]);

    if (isArrayConfig<TFormInfo["config"]>(config)) {
      return visitor.arrayInit(config as any, controls);
    } else if (isFieldConfig(config)) {
      return visitor.groupInit(config as any, controls, children);
    } else {
      return visitor.itemInit(config as any, children);
    }
  } else if (isFieldConfig(config)) {
    return visitor.fieldInit(config as any);
  }

  return visitor.itemInit(config as any, []);
}
