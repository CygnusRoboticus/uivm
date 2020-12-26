import { BaseArrayConfig, BaseFieldConfig, BaseGroupConfig, BaseItemConfig } from "./primitives";
import { DeepEmptyFlatten, DTK, EK, FK, Mutable, NK, TK, UnionToIntersection } from "./typing.utils";

export enum FieldDataType {
  StringType = "string",
  NumberType = "number",
  BooleanType = "boolean",
}

export interface FieldDataTypeDefinition {
  type: FieldDataType | unknown;
  null?: boolean;
  array?: boolean;
}

export interface FieldTypeMap<
  TConfig extends BaseItemConfig,
  TString extends Partial<TConfig>,
  TNumber extends Partial<TConfig>,
  TBoolean extends Partial<TConfig>,
  TArray extends Partial<TConfig>,
  TNull extends Partial<TConfig>
> {
  string: TString;
  number: TNumber;
  boolean: TBoolean;
  array: TArray;
  null: TNull;
}

// value utilities
type FieldTypeType<
  T extends TConfig,
  TConfig extends BaseItemConfig,
  TTypes extends FieldTypeMap<TConfig, TString, TNumber, TB, TArray, TNull>,
  TString = unknown,
  TNumber = unknown,
  TB = unknown,
  TArray = unknown,
  TNull = unknown
> = T extends BaseArrayConfig<TConfig>
  ? FormValue<T[FK], TConfig, TTypes>[]
  : T extends BaseGroupConfig<TConfig>
  ? FormValue<T[FK], TConfig, TTypes>
  : T extends TTypes["string"]
  ? FieldTypeNullable<T, TTypes["null"], FieldTypeArrayable<T, TTypes["array"], string>>
  : T extends TTypes["number"]
  ? FieldTypeNullable<T, TTypes["null"], FieldTypeArrayable<T, TTypes["array"], number>>
  : T extends TTypes["boolean"]
  ? FieldTypeNullable<T, TTypes["null"], FieldTypeArrayable<T, TTypes["array"], boolean>>
  : unknown;

type FieldDataTypeType<T extends BaseFieldConfig[DTK]> = T extends { type: FieldDataType.StringType }
  ? FieldTypeNullable<T, { null: true }, FieldTypeArrayable<T, { array: true }, string>>
  : T extends { type: FieldDataType.NumberType }
  ? FieldTypeNullable<T, { null: true }, FieldTypeArrayable<T, { array: true }, number>>
  : T extends { type: FieldDataType.BooleanType }
  ? FieldTypeNullable<T, { null: true }, FieldTypeArrayable<T, { array: true }, boolean>>
  : Extract<T, { type: unknown }>[TK];

type FieldTypeNullable<T, U, V> = T extends U ? V | null : V;
type FieldTypeArrayable<T, U, V> = T extends U ? V[] : V;

type MappedValues<
  T extends readonly TConfig[],
  TConfig extends BaseItemConfig,
  TTypes extends FieldTypeMap<TConfig, TString, TNumber, TB, TArray, TNull>,
  TString = unknown,
  TNumber = unknown,
  TB = unknown,
  TArray = unknown,
  TNull = unknown
> = Mutable<
  {
    [i in keyof T]: {
      [j in T[i] extends BaseFieldConfig ? T[i][NK] : EK]: T[i] extends { [k in DTK]: any }
        ? FieldDataTypeType<Extract<T[i], BaseFieldConfig>[DTK]>
        : FieldTypeType<Extract<T[i], TConfig>, TConfig, TTypes>;
    };
  }
>;

export type FormValue<
  TConfig extends readonly TConfigs[],
  TConfigs extends BaseItemConfig,
  TTypes extends FieldTypeMap<TConfigs, TString, TNumber, TB, TArray, TNull>,
  TString = unknown,
  TNumber = unknown,
  TB = unknown,
  TArray = unknown,
  TNull = unknown
> = UnionToIntersection<
  | Exclude<MappedValues<TConfig, TConfigs, TTypes>[number], { [k in EK]: unknown }>
  | DeepEmptyFlatten<MappedValues<TConfig, TConfigs, TTypes>[number]>
>;
