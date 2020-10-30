import { Observable } from "rxjs";
import { ExecutableDefinition, ExecutableRegistry } from "./executable";
import { BaseArrayConfig, BaseFieldConfig, BaseGroupConfig, BaseItemConfig } from "./primitives";
import { FieldDataTypeDefinition } from "./typing";

export interface Messages {
  [key: string]: {
    message: string;
    [key: string]: unknown;
  };
}

export interface AbstractFlags {
  hidden: boolean;
  [key: string]: boolean;
}

export interface ItemConfig<TRegistry extends ExecutableRegistry, TFlags extends AbstractFlags> extends BaseItemConfig {
  flags?: {
    [flag in keyof TFlags]: readonly ExecutableDefinition<TRegistry["flags"], Observable<boolean>>[];
  };
  triggers?: readonly ExecutableDefinition<TRegistry["triggers"], Observable<void>>[];
  messagers?: readonly ExecutableDefinition<TRegistry["messagers"], Observable<Messages | null>>[];
}

export interface FieldConfig<TRegistry extends ExecutableRegistry, TFlags extends AbstractFlags>
  extends ItemConfig<TRegistry, TFlags>,
    BaseFieldConfig {
  validators?: readonly ExecutableDefinition<TRegistry["validators"], Observable<Messages | null>>[];
  disablers?: readonly ExecutableDefinition<TRegistry["flags"], Observable<boolean>>[];
  dataType?: FieldDataTypeDefinition;
}

export type GroupConfig<
  TConfig extends ItemConfig<TRegistry, TFlags>,
  TRegistry extends ExecutableRegistry,
  TFlags extends AbstractFlags
> = ItemConfig<TRegistry, TFlags> & BaseGroupConfig<TConfig>;
export type ArrayConfig<
  TConfig extends ItemConfig<TRegistry, TFlags>,
  TRegistry extends ExecutableRegistry,
  TFlags extends AbstractFlags
> = FieldConfig<TRegistry, TFlags> & BaseArrayConfig<TConfig>;
