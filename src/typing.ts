import { ArrayControl, FieldControl, GroupControl, ItemControl } from "./controls";
import { AbstractHints, AbstractExtras } from "./controls.types";
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
  TS extends Partial<TConfig>,
  TN extends Partial<TConfig>,
  TB extends Partial<TConfig>,
  TArray extends Partial<TConfig>,
  TNull extends Partial<TConfig>
> {
  string: TS;
  number: TN;
  boolean: TB;
  array: TArray;
  null: TNull;
}

// value utilities
type FieldTypeType<
  T extends TConfig,
  TConfig extends BaseItemConfig,
  TTypes extends FieldTypeMap<TConfig, TS, TN, TB, TArray, TNull>,
  TS = unknown,
  TN = unknown,
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

type FieldValue<
  T extends TConfig,
  TConfig extends BaseItemConfig,
  TTypes extends FieldTypeMap<TConfig, TS, TN, TB, TArray, TNull>,
  TS = unknown,
  TN = unknown,
  TB = unknown,
  TArray = unknown,
  TNull = unknown
> = T extends {
  [k in DTK]: any;
}
  ? FieldDataTypeType<Extract<T, BaseFieldConfig>[DTK]>
  : FieldTypeType<Extract<T, TConfig>, TConfig, TTypes>;

type MappedValues<
  T extends readonly TConfig[],
  TConfig extends BaseItemConfig,
  TTypes extends FieldTypeMap<TConfig, TS, TN, TB, TArray, TNull>,
  TS = unknown,
  TN = unknown,
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
  T extends readonly TConfig[],
  TConfig extends BaseItemConfig,
  TTypes extends FieldTypeMap<TConfig, TS, TN, TB, TArray, TNull>,
  TS = unknown,
  TN = unknown,
  TB = unknown,
  TArray = unknown,
  TNull = unknown
> = UnionToIntersection<
  | Exclude<MappedValues<T, TConfig, TTypes>[number], { [k in EK]: unknown }>
  | DeepEmptyFlatten<MappedValues<T, TConfig, TTypes>[number]>
>;

// control utilities
type FieldControlType<
  T extends TConfig,
  TConfig extends BaseFieldConfig,
  TTypes extends FieldTypeMap<TConfig, TS, TN, TB, TArray, TNull>,
  THints extends AbstractHints,
  TExtras extends AbstractExtras,
  TS = unknown,
  TN = unknown,
  TB = unknown,
  TArray = unknown,
  TNull = unknown
> = T extends BaseArrayConfig<TConfig>
  ? ArrayControl<
      // @ts-ignore
      FormValue<T[FK], TConfig, TTypes>,
      FormControls<T[FK], TConfig, TTypes, THints, TExtras>,
      THints
    >
  : T extends BaseFieldConfig
  ? T extends BaseGroupConfig<TConfig>
    ? GroupControl<
        // @ts-ignore
        FormValue<T[FK], TConfig, TTypes>,
        FormControls<T[FK], TConfig, TTypes, THints, TExtras>,
        THints
      >
    : FieldControl<FieldValue<T, TConfig, TTypes>, THints, TExtras>
  : ItemControl<THints, TExtras>;

type MappedControls<
  T extends readonly TConfig[],
  TConfig extends BaseItemConfig,
  TTypes extends FieldTypeMap<TConfig, TS, TN, TB, TArray, TNull>,
  THints extends AbstractHints,
  TExtras extends AbstractExtras,
  TS = unknown,
  TN = unknown,
  TB = unknown,
  TArray = unknown,
  TNull = unknown
> = Mutable<
  {
    [i in keyof T]: {
      [j in T[i] extends BaseFieldConfig ? T[i][NK] : EK]: T[i] extends BaseFieldConfig
        ? // @ts-ignore
          FieldControlType<T[i], TConfig, TTypes, THints, TExtras>
        : T[i] extends BaseGroupConfig<TConfig>
        ? FormControls<T[i][FK], TConfig, TTypes, THints, TExtras>
        : never;
    };
  }
>;

export type FormControls<
  T extends readonly TConfig[],
  TConfig extends BaseItemConfig,
  TTypes extends FieldTypeMap<TConfig, TS, TN, TB, TArray, TNull>,
  THints extends AbstractHints,
  TExtras extends AbstractExtras,
  TS = unknown,
  TN = unknown,
  TB = unknown,
  TArray = unknown,
  TNull = unknown
> = UnionToIntersection<
  | Exclude<MappedControls<T, TConfig, TTypes, THints, TExtras>[number], { [k in EK]: unknown }>
  | DeepEmptyFlatten<MappedControls<T, TConfig, TTypes, THints, TExtras>[number]>
>;

export type FormControl<
  T extends readonly TConfig[],
  TConfig extends BaseItemConfig,
  TTypes extends FieldTypeMap<TConfig, TS, TN, TB, TArray, TNull>,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras,
  TS = unknown,
  TN = unknown,
  TB = unknown,
  TArray = unknown,
  TNull = unknown
> = GroupControl<
  // @ts-ignore
  FormValue<T, TConfig, TTypes>,
  FormControls<T, TConfig, TTypes, THints, TExtras>,
  THints
>;
