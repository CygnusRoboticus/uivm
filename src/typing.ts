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
  T extends TConfig,
  TConfig extends BaseItemConfig,
  TTypes extends FieldTypeMap<TConfig, TString, TNumber, TBoolean, TArray, TNull, TUndefined>,
  TString = unknown,
  TNumber = unknown,
  TBoolean = unknown,
  TArray = unknown,
  TNull = unknown,
  TUndefined = unknown
> = T extends BaseArrayConfig<TConfig>
  ? FormValue<T[FK][FK], TConfig, TTypes>[]
  : T extends BaseGroupConfig<TConfig>
  ? FormValue<T[FK], TConfig, TTypes>
  : T extends ExtractOther<T, TTypes["string"] | TTypes["number"] | TTypes["boolean"], any>
  ?
      | ExtractOther<T, TTypes["null"], null>
      | ExtractOther<T, TTypes["undefined"], undefined>
      | FieldTypeArrayable<
          T,
          TTypes["array"],
          | ExtractOther<T, TTypes["string"], string>
          | ExtractOther<T, TTypes["number"], number>
          | ExtractOther<T, TTypes["boolean"], boolean>
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
  TConfig extends readonly TConfigs[],
  TConfigs extends BaseItemConfig,
  TTypes extends FieldTypeMap<TConfigs, TString, TNumber, TBoolean, TArray, TNull, TUndefined>,
  TString = unknown,
  TNumber = unknown,
  TBoolean = unknown,
  TArray = unknown,
  TNull = unknown,
  TUndefined = unknown
> = UnionToIntersection<
  | Exclude<MappedValues<TConfig, TConfigs, TTypes>[number], { [k in EK]: unknown }>
  | DeepEmptyFlatten<MappedValues<TConfig, TConfigs, TTypes>[number]>
>;
