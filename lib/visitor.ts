// @ts-nocheck

import { Observable } from "rxjs";
import {
  AnyConfig,
  ArrayConfig,
  FieldConfig,
  GroupConfig,
  isArrayConfig,
  isFieldConfig,
  isGroupConfig,
  ItemConfig,
} from "./configs";
import { AbstractStatus, ArrayControl, FieldControl, GroupControl, ItemControl } from "./controls";

interface Visitor<TConfig extends ItemConfig, TStatus extends AbstractStatus> {
  item: (config: TConfig) => ItemControl<TStatus>;
  field: <TValue>(config: FieldConfig) => FieldControl<TValue, TStatus>;
  group: <TValue>(config: GroupConfig<TConfig>, bundled: any) => GroupControl<TValue, TStatus>;
  array: <TValue>(
    config: ArrayConfig<TConfig>,
    bundled: any,
  ) => ArrayControl<TValue, GroupControl<TValue, TStatus>, TStatus>;
}

function recurseFieldItems<TBundle extends AnyBundle<TConfig>, TConfig extends AnyConfig, TValue>(
  bundled: TBundle[],
  predicate: (b: FieldBundle<TConfig, TValue>) => Observable<TValue | null>,
) {
  return bundled.reduce((acc, b) => {
    if (isFieldConfig(b.config)) {
      acc.push(predicate(b as FieldBundle<TConfig, TValue>));
    }
    return acc;
  }, <Observable<TValue | null>[]>[]);
}

class DefaultVisitor<TConfig extends ItemConfig, TStatus extends AbstractStatus> implements Visitor<TConfig, TStatus> {
  item<T>(config: TConfig) {
    return new ItemControl<TStatus>();
  }
  field<T>(config: FieldConfig) {
    return new FieldControl(null);
  }
  group<TConfig extends AnyConfig, TValue>(
    config: GroupConfig<TConfig>,
    bundled: ConfigBundle<TConfig, TValue[keyof TValue]>,
  ) {
    return GroupControl(null);
  }
  array<TConfig extends AnyConfig, TValue>(config: ArrayConfig, bundled: ConfigBundle<TConfig, TValue[keyof TValue]>) {
    new ArrayControl();
  }
}

export function bundleConfig<TConfig extends ItemConfig, TValue = unknown>(
  config: TConfig,
  visitor: Visitor<TConfig> = new DefaultVisitor<TConfig>(),
): AnyBundle<AnyConfig<TConfig>, TValue> {
  if (isArrayConfig<TConfig>(config)) {
    const bundled = bundleConfig<AnyConfig<TConfig>, Visitor<TConfig>>(config, visitor);
    return visitor.array<TValue>(config, bundled);
  } else if (isGroupConfig(config)) {
    const bundled = bundleConfig<AnyConfig<TConfig>, Visitor<TConfig>>(config, visitor);
    if (isFieldConfig(config)) {
      return visitor.group<TValue>(config, bundled);
    } else {
      return visitor.group<TValue>(config, bundled);
    }
  } else if (isFieldConfig(config)) {
    return visitor.field<TValue>(config);
  }
  return visitor.item(config);
}
