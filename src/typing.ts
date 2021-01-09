import { BaseArrayConfig, BaseFieldConfig, BaseGroupConfig, BaseItemConfig } from "./primitives";
import { DeepEmptyFlatten, DTK, EK, FK, Mutable, NK, TK, UnionToIntersection } from "./typing.utils";

export enum FieldDataType {
  StringType = "string",
  NumberType = "number",
  BooleanType = "boolean",
}

export interface FieldDataTypeDefinition {
  type: FieldDataType | unknown;
  array?: boolean;
  null?: boolean;
  undefined?: boolean;
}

export interface FieldTypeMap<
  TConfig extends BaseItemConfig,
  TString extends Partial<TConfig>,
  TNumber extends Partial<TConfig>,
  TBoolean extends Partial<TConfig>,
  TArray extends Partial<TConfig>,
  TNull extends Partial<TConfig>,
  TUndefined extends Partial<TConfig>
> {
  string: TString;
  number: TNumber;
  boolean: TBoolean;
  array: TArray;
  null: TNull;
  undefined: TUndefined;
}

// value utilities
type FieldTypeType<
  TConfig extends TConfigs,
  TConfigs extends BaseItemConfig,
  TTypes extends FieldTypeMap<TConfigs, TString, TNumber, TBoolean, TArray, TNull, TUndefined>,
  TString = unknown,
  TNumber = unknown,
  TBoolean = unknown,
  TArray = unknown,
  TNull = unknown,
  TUndefined = unknown
> = TConfig extends BaseArrayConfig<TConfigs>
  ? FormValue<TConfig[FK], TConfigs, TTypes>[]
  : TConfig extends BaseGroupConfig<TConfigs>
  ? FormValue<TConfig, TConfigs, TTypes>
  : TConfig extends ExtractOther<TConfig, TTypes["string"] | TTypes["number"] | TTypes["boolean"], any>
  ?
      | ExtractOther<TConfig, TTypes["null"], null>
      | ExtractOther<TConfig, TTypes["undefined"], undefined>
      | FieldTypeArrayable<
          TConfig,
          TTypes["array"],
          | ExtractOther<TConfig, TTypes["string"], string>
          | ExtractOther<TConfig, TTypes["number"], number>
          | ExtractOther<TConfig, TTypes["boolean"], boolean>
        >
  : unknown;

type FieldDataTypeType<T extends BaseFieldConfig> = T extends Extract<
  T,
  | { dataType: { type: FieldDataType.StringType } }
  | { dataType: { type: FieldDataType.NumberType } }
  | { dataType: { type: FieldDataType.BooleanType } }
>
  ?
      | ExtractOther<T, { dataType: { null: true } }, null>
      | ExtractOther<T, { dataType: { undefined: true } }, undefined>
      | FieldTypeArrayable<
          T,
          { dataType: { array: true } },
          | ExtractOther<T, { dataType: { type: FieldDataType.StringType } }, string>
          | ExtractOther<T, { dataType: { type: FieldDataType.NumberType } }, number>
          | ExtractOther<T, { dataType: { type: FieldDataType.BooleanType } }, boolean>
        >
  : Extract<T, { dataType: { type: unknown } }>[DTK][TK];

/**
 * Extract from V those types where T is assignable to U
 */
type ExtractOther<T, U, V> = T extends U ? V : never;
type FieldTypeArrayable<T, U, V> = T extends U ? V[] : V;

type MappedValues<
  T extends readonly TConfig[],
  TConfig extends BaseItemConfig,
  TTypes extends FieldTypeMap<TConfig, TString, TNumber, TB, TArray, TNull, TUndefined>,
  TString = unknown,
  TNumber = unknown,
  TB = unknown,
  TArray = unknown,
  TNull = unknown,
  TUndefined = unknown
> = Mutable<
  {
    [i in keyof T]: {
      [j in T[i] extends BaseFieldConfig ? T[i][NK] : EK]: T[i] extends { [k in DTK]: any }
        ? FieldDataTypeType<Extract<T[i], BaseFieldConfig>>
        : FieldTypeType<Extract<T[i], TConfig>, TConfig, TTypes>;
    };
  }
>;

export type FormValue<
  TConfig extends BaseGroupConfig<TConfigs> & TConfigs,
  TConfigs extends BaseItemConfig,
  TTypes extends FieldTypeMap<TConfigs, TString, TNumber, TBoolean, TArray, TNull, TUndefined>,
  TString = unknown,
  TNumber = unknown,
  TBoolean = unknown,
  TArray = unknown,
  TNull = unknown,
  TUndefined = unknown
> = UnionToIntersection<
  | Exclude<MappedValues<TConfig["fields"], TConfigs, TTypes>[number], { [k in EK]: unknown }>
  | DeepEmptyFlatten<MappedValues<TConfig["fields"], TConfigs, TTypes>[number]>
>;
