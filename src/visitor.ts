import { tuple } from "fp-ts/lib/function";
import { map } from "rxjs/operators";
import { ArrayConfig, FieldConfig, GroupConfig, ItemConfig } from "./configs";
import { ArrayControl, FieldControl, GroupControl, ItemControl } from "./controls";
import {
  AbstractExtras,
  AbstractHints,
  Disabler,
  Executor,
  Extraer,
  Hinter,
  Trigger,
  Validator,
} from "./controls.types";
import { FuzzyExecutableRegistry } from "./executable";
import { BaseArrayConfig, BaseFieldConfig, BaseGroupConfig, BaseItemConfig } from "./primitives";
import { isArrayConfig, isFieldConfig, isGroupConfig, toObservable } from "./utils";
import { getRegistryValues } from "./visitor.utils";

export type VisitorControls<TVisitor extends Visitor<any, any, any, any, any, any, any>> = ReturnType<
  | TVisitor["itemInit"]
  | TVisitor["fieldInit"]
  | TVisitor["containerInit"]
  | TVisitor["groupInit"]
  | TVisitor["arrayInit"]
>;

export abstract class Visitor<
  TConfigs extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry,
  TItemControl,
  TFieldControl,
  TContainerControl,
  TGroupControl,
  TArrayControl
> {
  abstract itemInit: (config: BaseItemConfig & TConfigs, registry: TRegistry) => TItemControl;
  abstract fieldInit: (config: BaseFieldConfig & TConfigs, registry: TRegistry) => TFieldControl;
  abstract containerInit: (config: BaseGroupConfig<TConfigs> & TConfigs, registry: TRegistry) => TContainerControl;
  abstract groupInit: (
    config: BaseGroupConfig<TConfigs> & BaseFieldConfig & TConfigs,
    registry: TRegistry,
  ) => TGroupControl;
  abstract arrayInit: (config: BaseArrayConfig<TConfigs> & TConfigs, registry: TRegistry) => TArrayControl;

  complete?: (
    control: TItemControl | TFieldControl | TContainerControl | TGroupControl | TArrayControl,
    registry: TRegistry,
  ) => void;
}

export function buildChildren<
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry,
  TVisitor extends Visitor<
    TConfig,
    TRegistry,
    TItemControl,
    TFieldControl,
    TContainerControl,
    TGroupControl,
    TArrayControl
  >,
  TItemControl = any,
  TFieldControl = any,
  TContainerControl = any,
  TGroupControl = any,
  TArrayControl = any
>(config: BaseGroupConfig<TConfig> & TConfig, registry: TRegistry, visitor: TVisitor) {
  return config.fields.map(f => {
    return bundleConfig2<
      TConfig,
      TRegistry,
      ReturnType<TVisitor["itemInit"]>,
      ReturnType<TVisitor["fieldInit"]>,
      ReturnType<TVisitor["containerInit"]>,
      ReturnType<TVisitor["groupInit"]>,
      ReturnType<TVisitor["arrayInit"]>,
      any
    >(f, registry, visitor);
  });
}

export interface BasicVisitorExtras<
  TConfigs extends ItemConfig<TRegistry, THints, TExtras>,
  TRegistry extends FuzzyExecutableRegistry,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras
> extends AbstractExtras {
  config: TConfigs;
  registry: TRegistry;
}

export class BasicVisitor<
  TConfigs extends ItemConfig<TRegistry, THints, TExtras>,
  TRegistry extends FuzzyExecutableRegistry = FuzzyExecutableRegistry,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras
> implements
    Visitor<
      TConfigs,
      TRegistry,
      ItemControl<THints, BasicVisitorExtras<TConfigs, TRegistry, THints, TExtras>>,
      FieldControl<unknown, THints, BasicVisitorExtras<TConfigs, TRegistry, THints, TExtras>>,
      ItemControl<THints, BasicVisitorExtras<TConfigs, TRegistry, THints, TExtras>>,
      GroupControl<any, THints, BasicVisitorExtras<TConfigs, TRegistry, THints, TExtras>>,
      ArrayControl<any, THints, BasicVisitorExtras<TConfigs, TRegistry, THints, TExtras>>
    > {
  itemInit(
    config: ItemConfig<TRegistry, THints, TExtras> & TConfigs,
    registry: TRegistry,
  ): ItemControl<THints, BasicVisitorExtras<TConfigs, TRegistry, THints, TExtras>> {
    return new ItemControl<THints, BasicVisitorExtras<TConfigs, TRegistry, THints, TExtras>>({
      extras: [() => ({ config, registry })],
    });
  }
  fieldInit(
    config: FieldConfig<TRegistry, THints, TExtras> & TConfigs,
    registry: TRegistry,
  ): FieldControl<unknown, THints, BasicVisitorExtras<TConfigs, TRegistry, THints, TExtras>> {
    return new FieldControl<unknown, THints, BasicVisitorExtras<TConfigs, TRegistry, THints, TExtras>>(null, {
      extras: [() => ({ config, registry })],
    });
  }
  containerInit(
    config: GroupConfig<TConfigs, TRegistry, THints, TExtras> & TConfigs,
    registry: TRegistry,
  ): ItemControl<THints, BasicVisitorExtras<TConfigs, TRegistry, THints, TExtras>> {
    const children = buildChildren(config, registry, this);
    const control = new ItemControl<THints, BasicVisitorExtras<TConfigs, TRegistry, THints, TExtras>>({
      extras: [() => ({ config, registry })],
    });
    children.forEach(c => c.setParent(control));
    return control;
  }
  groupInit(
    config: GroupConfig<TConfigs, TRegistry, THints, TExtras> & FieldConfig<TRegistry, THints, TExtras> & TConfigs,
    registry: TRegistry,
  ): GroupControl<any, THints, BasicVisitorExtras<TConfigs, TRegistry, THints, TExtras>> {
    const children = buildChildren(config, registry, this);
    const control = new GroupControl<{}, THints, BasicVisitorExtras<TConfigs, TRegistry, THints, TExtras>>(
      {},
      { extras: [() => ({ config, registry })] },
    );

    const reduceControls = (ctrl: ItemControl<THints, BasicVisitorExtras<TConfigs, TRegistry, THints, TExtras>>) => {
      ctrl.children.forEach(c => {
        const child = c as ItemControl<THints, BasicVisitorExtras<TConfigs, TRegistry, THints, TExtras>>;
        if (child.extras.config && isFieldConfig<TConfigs>(child.extras.config) && child instanceof FieldControl) {
          control.addControl(child.extras.config.name, child, false);
        } else {
          reduceControls(child);
        }
      });
    };

    children.forEach(child => {
      if (child.extras.config && isFieldConfig<TConfigs>(child.extras.config) && child instanceof FieldControl) {
        control.addControl(child.extras.config.name, child);
      } else {
        control.addChild(child);
        reduceControls(child);
      }
    });

    return control;
  }
  arrayInit(
    config: ArrayConfig<TConfigs, TRegistry, THints, TExtras> & TConfigs,
    registry: TRegistry,
  ): ArrayControl<any, THints, BasicVisitorExtras<TConfigs, TRegistry, THints, TExtras>> {
    return new ArrayControl<any, THints, BasicVisitorExtras<TConfigs, TRegistry, THints, TExtras>>(
      () => this.groupInit({ ...config.fields, name: "group" }, registry),
      undefined,
      { extras: [() => ({ config, registry })] },
    );
  }

  complete(
    control: ItemControl<THints, BasicVisitorExtras<TConfigs, TRegistry, THints, TExtras>>,
    registry: TRegistry,
  ) {
    control.children.forEach(c => this.complete?.(c as any, registry));

    if (control instanceof FieldControl) {
      this.initField(control, registry);
    } else {
      this.initItem(control, registry);
    }
  }

  private initItem(
    control: ItemControl<THints, BasicVisitorExtras<TConfigs, TRegistry, THints, TExtras>>,
    registry: TRegistry,
  ) {
    type TBVExtras = BasicVisitorExtras<TConfigs, TRegistry, THints, TExtras>;

    const config = control.extras.config;
    if (!config) {
      throw new Error(`Could not initialize control (${control}), \`extras.config\` is missing.`);
    }

    const hints = Object.entries(config.hints ?? {}).reduce((acc, [key, value]) => {
      const sources = getRegistryValues<
        typeof registry,
        typeof config,
        typeof control,
        Executor<typeof control, boolean>
      >(registry, "hints", config, control, value as any).map(s => (c: ItemControl<THints, TBVExtras>) =>
        toObservable(s(c)).pipe(map(v => tuple(key, v))),
      );
      acc.push(...sources);
      return acc;
    }, <Hinter<ItemControl<THints, TBVExtras>, THints>[]>[]);

    const extras = Object.entries(config.extras ?? {}).reduce((acc, [key, value]) => {
      const sources = getRegistryValues<
        typeof registry,
        typeof config,
        typeof control,
        Executor<typeof control, TExtras[keyof TExtras]>
      >(registry, "extras", config, control, [value as any]).map(s => (c: ItemControl<THints, TBVExtras>) =>
        toObservable(s(c)).pipe(map(v => ({ [key]: v } as Partial<TExtras>))),
      );
      acc.push(...sources);
      return acc;
    }, <Extraer<ItemControl<THints, TBVExtras>, TExtras>[]>[]);

    const messages = config.messagers
      ? getRegistryValues<typeof registry, typeof config, typeof control, Validator<typeof control>>(
          registry,
          "validators",
          config,
          control,
          config.messagers as any,
        )
      : [];

    control.setHinters(hints);
    control.addExtraers(...extras);
    control.setMessagers(messages);
  }

  private initField(
    control: FieldControl<any, THints, BasicVisitorExtras<TConfigs, TRegistry, THints, TExtras>>,
    registry: TRegistry,
  ) {
    type TBVExtras = BasicVisitorExtras<TConfigs, TRegistry, THints, TExtras>;

    const config = (control.extras.config as unknown) as FieldConfig<TRegistry, THints, TBVExtras>;
    this.initItem(control, registry);

    const disablers = config.disablers
      ? getRegistryValues<typeof registry, typeof config, typeof control, Disabler<typeof control>>(
          registry,
          "hints",
          config,
          control,
          config.disablers as any,
        )
      : [];

    const validators = config.validators
      ? getRegistryValues<typeof registry, typeof config, typeof control, Validator<typeof control>>(
          registry,
          "validators",
          config,
          control,
          config.validators as any,
        )
      : [];

    const triggers = config.triggers
      ? getRegistryValues<typeof registry, typeof config, typeof control, Trigger<typeof control>>(
          registry,
          "triggers",
          config,
          control,
          config.triggers as any,
        )
      : [];

    control.setDisablers(disablers);
    control.setTriggers(triggers);
    control.setValidators(validators);
  }
}

export function createConfigBuilder<
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry,
  TVisitor extends Visitor<
    TConfig,
    TRegistry,
    TItemControl,
    TFieldControl,
    TContainerControl,
    TGroupControl,
    TArrayControl
  >,
  TItemControl = any,
  TFieldControl = any,
  TContainerControl = any,
  TGroupControl = any,
  TArrayControl = any
>(registry: TRegistry, visitor: TVisitor) {
  return <
    T extends TConfig,
    TRootControl extends VisitorControls<TVisitor> = T extends BaseArrayConfig<TConfig>
      ? ReturnType<TVisitor["arrayInit"]>
      : T extends BaseFieldConfig & BaseGroupConfig<TConfig>
      ? ReturnType<TVisitor["groupInit"]>
      : T extends BaseGroupConfig<TConfig>
      ? ReturnType<TVisitor["containerInit"]>
      : T extends BaseFieldConfig
      ? ReturnType<TVisitor["fieldInit"]>
      : T extends BaseItemConfig
      ? ReturnType<TVisitor["itemInit"]>
      : VisitorControls<TVisitor>,
    TOverrideRegistry extends TRegistry = TRegistry
  >(
    config: T,
    overrideRegistry?: TOverrideRegistry,
  ) => {
    const control = bundleConfig2<
      TConfig,
      TRegistry,
      ReturnType<TVisitor["itemInit"]>,
      ReturnType<TVisitor["fieldInit"]>,
      ReturnType<TVisitor["containerInit"]>,
      ReturnType<TVisitor["groupInit"]>,
      ReturnType<TVisitor["arrayInit"]>,
      any
    >(config, overrideRegistry ?? registry, visitor);
    visitor.complete?.(control, overrideRegistry ?? registry);
    return control as TRootControl;
  };
}

function bundleConfig2<
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry,
  TItemControl,
  TFieldControl,
  TContainerControl,
  TGroupControl,
  TArrayControl,
  TVisitor extends Visitor<
    TConfig,
    TRegistry,
    TItemControl,
    TFieldControl,
    TContainerControl,
    TGroupControl,
    TArrayControl
  >
>(config: TConfig, registry: TRegistry, visitor: TVisitor) {
  if (isGroupConfig<TConfig>(config)) {
    if (isFieldConfig<TConfig>(config)) {
      return visitor.groupInit(config, registry);
    }
    return visitor.containerInit(config, registry);
  } else if (isArrayConfig<TConfig>(config)) {
    return visitor.arrayInit(config, registry);
  } else if (isFieldConfig<TConfig>(config)) {
    return visitor.fieldInit(config, registry);
  }
  return visitor.itemInit(config, registry);
}
