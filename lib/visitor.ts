// @ts-nocheck

import { BehaviorSubject, combineLatest, Observable } from "rxjs";
import {
  AnyConfig,
  ArrayConfig,
  FieldConfig,
  FormItemConfig,
  GroupConfig,
  isArrayConfig,
  isFieldConfig,
  isGroupConfig,
} from "./configs";
import { map, tap } from "rxjs/operators";

interface Visitor<TConfig extends FormItemConfig> {
  item: (config: TConfig) => ItemBundle<TConfig>;
  field: <TValue>(config: FieldConfig) => FieldBundle<FieldConfig, TValue>;
  group: <TValue>(
    config: GroupConfig<TConfig>,
    bundled: ConfigBundle<TConfig, TValue[keyof TValue]>,
  ) => GroupBundle<GroupConfig, TValue>;
  array: <TValue>(
    config: ArrayConfig<TConfig>,
    bundled: ConfigBundle<TConfig, TValue[keyof TValue]>,
  ) => ArrayBundle<ArrayConfig, TValue>;
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

class DefaultVisitor<TConfig extends FormItemConfig> implements Visitor<TConfig> {
  item<T>(config: TConfig) {
    return { config };
  }

  field<T>(config: FieldConfig) {
    const value$ = new BehaviorSubject<T | null>(null);
    const status$ = new BehaviorSubject({ valid: false, pending: false });
    return {
      config,
      value$,
      status$,
      get value() {
        return value$.getValue();
      },
      get status() {
        return status$.getValue();
      },
      set(value: T | null) {
        value$.next(value);
        return value$.getValue();
      },
    };
  }

  group<TConfig extends AnyConfig, TValue>(
    config: GroupConfig<TConfig>,
    bundled: ConfigBundle<TConfig, TValue[keyof TValue]>,
  ) {
    const valueObs = Object.entries(bundled.fields).map(([k, b]) =>
      b.value$.pipe(map(v => ({ k: k as keyof TValue, v }))),
    );
    let value: TValue = ({} as unknown) as TValue;
    const value$ = combineLatest(valueObs).pipe(
      map(kvp =>
        kvp.reduce((acc, { k, v }) => {
          acc[k] = v as any;
          return acc;
        }, ({} as unknown) as TValue),
      ),
      map(v => v),
      tap(v => (value = v as any)),
    );
    const status$ = new BehaviorSubject({ valid: false, pending: false });
    return {
      config,
      value$,
      status$,
      fields: bundled.fields as any,
      items: bundled.items as any[],
      get value() {
        return value;
      },
      get status() {
        return status$.getValue();
      },
      set(value: TValue | null) {
        return value;
      },
    };
  }

  array<TConfig extends AnyConfig, TValue>(config: ArrayConfig, bundled: ConfigBundle<TConfig, TValue[keyof TValue]>) {
    const value$ = new BehaviorSubject<TValue | null>(null);
    const status$ = new BehaviorSubject({ valid: false, pending: false });
    return {
      config,
      value$,
      status$,
      fields: bundled.fields as any,
      items: bundled.items as any[],
      get value() {
        return value$.getValue();
      },
      get status() {
        return status$.getValue();
      },
      set(value: TValue | null) {
        value$.next(value);
        return value$.getValue();
      },
    };
  }
}

type AnyBundle<TConfig extends FormItemConfig, TValue = unknown> =
  | ItemBundle<TConfig>
  | (TConfig extends FieldConfig ? FieldBundle<TConfig> : never)
  | (TConfig extends GroupConfig ? GroupBundle<TConfig, TValue> : never)
  | (TConfig extends ArrayConfig ? ArrayBundle<TConfig, TValue> : never);

interface ItemBundle<TConfig extends FormItemConfig> {
  config: TConfig;
}

interface FieldBundle<TConfig extends FieldConfig, TValue = unknown> extends ItemBundle<TConfig> {
  value$: Observable<TValue | null>;
  value: TValue | null;
  status$: Observable<{ valid: boolean; pending: boolean }>;
  status: { valid: boolean; pending: boolean };

  set(value: TValue | null): TValue | null;
}

interface GroupBundle<TConfig extends GroupConfig, TValue = unknown> extends FieldBundle<TConfig, TValue> {
  fields: FieldBundle<TConfig, TValue>;
  items: ItemBundle<TConfig>[];
}

interface ArrayBundle<TConfig extends ArrayConfig, TValue = unknown> extends FieldBundle<TConfig, TValue> {
  fields: GroupBundle<TConfig, TValue[]>;
  items: ItemBundle<TConfig>[];
}

export function bundleConfig<TConfig extends FormItemConfig, TValue = unknown>(
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
