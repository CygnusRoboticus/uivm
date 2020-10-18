import { AbstractFlags, ArrayControl, FieldControl, GroupControl, ItemControl } from "./controls";
import { AnyConfig, BaseArrayConfig, BaseFieldConfig, BaseGroupConfig, BaseItemConfig } from "./primitives";

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

type FieldTypeType<
  T extends AnyConfig<TConfig>,
  TMap extends FieldTypeMap<TConfig, TS, TN, TB, TArray, TNull>,
  TConfig extends BaseItemConfig = BaseItemConfig,
  TS = unknown,
  TN = unknown,
  TB = unknown,
  TArray = unknown,
  TNull = unknown
> = T extends BaseArrayConfig<TConfig>
  ? FormValue<T[FK], TMap, TConfig, TS, TN, TB, TArray, TNull>[]
  : T extends BaseGroupConfig<TConfig>
  ? FormValue<T[FK], TMap, TConfig, TS, TN, TB, TArray, TNull>
  : T extends TMap["string"]
  ? FieldTypeNullable<T, TMap["null"], FieldTypeArrayable<T, TMap["array"], string>>
  : T extends TMap["number"]
  ? FieldTypeNullable<T, TMap["null"], FieldTypeArrayable<T, TMap["array"], number>>
  : T extends TMap["boolean"]
  ? FieldTypeNullable<T, TMap["null"], FieldTypeArrayable<T, TMap["array"], boolean>>
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

type FieldControlType<
  T extends BaseItemConfig,
  TValue extends { [key: string]: TValue[keyof TValue] },
  TConfig extends BaseItemConfig = BaseItemConfig,
  TFlags extends AbstractFlags = AbstractFlags
> = T extends BaseArrayConfig<TConfig>
  ? ArrayControl<
      // @ts-ignore
      TValue[T[NK]][number],
      // @ts-ignore
      GroupControl<TValue[T[NK]][number], FormControls<T[FK], TValue[T[NK]][number]>, TFlags>,
      // @ts-ignore
      FormControls<T[FK], TValue[T[NK]][number], TConfig, TFlags>,
      TFlags
    >
  : T extends BaseFieldConfig
  ? T extends BaseGroupConfig<TConfig>
    ? // @ts-ignore
      GroupControl<TValue[T[NK]], FormControls<T[FK], TValue[T[NK]], TConfig, TFlags>, TFlags>
    : FieldControl<TValue[T[NK]], TFlags>
  : ItemControl<TFlags>;

type MappedFields<
  T extends readonly TConfig[],
  TMap extends FieldTypeMap<TConfig, TS, TN, TB, TArray, TNull>,
  TConfig extends BaseItemConfig = BaseItemConfig,
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
        : FieldTypeType<Extract<T[i], AnyConfig<TConfig>>, TMap, TConfig, TS, TN, TB, TArray, TNull>;
    };
  }
>;

type MappedControls<
  T extends readonly TConfig[],
  TValue extends { [key: string]: TValue[keyof TValue] },
  TConfig extends BaseItemConfig = BaseItemConfig,
  TFlags extends AbstractFlags = AbstractFlags
> = Mutable<
  {
    [i in keyof T]: {
      [j in T[i] extends BaseFieldConfig ? T[i][NK] : EK]: T[i] extends BaseFieldConfig
        ? FieldControlType<T[i], TValue, TConfig, TFlags>
        : T[i] extends BaseGroupConfig<TConfig>
        ? FormControls<T[i][FK], TValue, TConfig, TFlags>
        : never;
    };
  }
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

export type FormValue<
  T extends readonly TConfig[],
  TMap extends FieldTypeMap<TConfig, TS, TN, TB, TArray, TNull>,
  TConfig extends BaseItemConfig = BaseItemConfig,
  TS = unknown,
  TN = unknown,
  TB = unknown,
  TArray = unknown,
  TNull = unknown
> = UnionToIntersection<
  | Exclude<MappedFields<T, TMap, TConfig, TS, TN, TB, TArray, TNull>[number], { [k in EK]: unknown }>
  | DeepEmptyFlatten<MappedFields<T, TMap, TConfig, TS, TN, TB, TArray, TNull>[number]>
>;

export type FormControl<
  T extends readonly TConfig[],
  TValue,
  TConfig extends BaseItemConfig = BaseItemConfig,
  TFlags extends AbstractFlags = AbstractFlags
  // @ts-ignore
> = GroupControl<TValue, FormControls<T, TValue>, TFlags>;

type FormControls<
  T extends readonly TConfig[],
  TValue extends { [key: string]: TValue[keyof TValue] },
  TConfig extends BaseItemConfig = BaseItemConfig,
  TFlags extends AbstractFlags = AbstractFlags
> = UnionToIntersection<
  | Exclude<MappedControls<T, TValue, TConfig, TFlags>[number], { [k in EK]: unknown }>
  | DeepEmptyFlatten<MappedControls<T, TValue, TConfig, TFlags>[number]>
>;
