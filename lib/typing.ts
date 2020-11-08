import { ArrayControl, FieldControl, GroupControl, ItemControl } from "./controls";
import { AbstractHints, AbstractExtras } from "./controls.types";
import { BaseArrayConfig, BaseFieldConfig, BaseGroupConfig, BaseItemConfig } from "./primitives";

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

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

type EK = "";
type NK = "name";
type TK = "type";
type DTK = "dataType";
type FK = "fields";

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

// @see https://medium.com/@flut1/deep-flatten-typescript-types-with-finite-recursion-cb79233d93ca
type NonEmptyKeys<T> = Exclude<keyof T, EK>;
type EmptyValues<T> = Extract<T, { [k in EK]: unknown }>[EK];
type EmptyObjectValues<T> = Exclude<Extract<EmptyValues<T>, object>, Array<any>>;
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

type DFBase<T, Recursor> = Pick<T, NonEmptyKeys<T>> & UnionToIntersection<Recursor>;
type DeepEmptyFlatten<T> = T extends any ? DFBase<T, DF2<EmptyObjectValues<T>>> : never;
type DF2<T> = T extends any ? DFBase<T, DF3<EmptyObjectValues<T>>> : never;
type DF3<T> = T extends any ? DFBase<T, DF4<EmptyObjectValues<T>>> : never;
type DF4<T> = T extends any ? DFBase<T, DF5<EmptyObjectValues<T>>> : never;
type DF5<T> = T extends any ? DFBase<T, DF6<EmptyObjectValues<T>>> : never;
type DF6<T> = T extends any ? DFBase<T, DF7<EmptyObjectValues<T>>> : never;
type DF7<T> = T extends any ? DFBase<T, DF8<EmptyObjectValues<T>>> : never;
type DF8<T> = T extends any ? DFBase<T, DF9<EmptyObjectValues<T>>> : never;
type DF9<T> = T extends any ? DFBase<T, EmptyObjectValues<T>> : never;

export type Obj = { [key: string]: any };

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
