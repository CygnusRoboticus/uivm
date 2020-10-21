import { FormInfoBase } from "./configs";
import { ArrayControl, FieldControl, GroupControl, ItemControl } from "./controls";
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

export interface FieldTypeMap<TConfig extends BaseItemConfig> {
  string: Partial<TConfig>;
  number: Partial<TConfig>;
  boolean: Partial<TConfig>;
  array: Partial<TConfig>;
  null: Partial<TConfig>;
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
type FieldTypeType<T extends TFormInfo["config"], TFormInfo extends FormInfoBase> = T extends BaseArrayConfig<
  TFormInfo["config"]
>
  ? FormValue<T[FK], TFormInfo>[]
  : T extends BaseGroupConfig<TFormInfo["config"]>
  ? FormValue<T[FK], TFormInfo>
  : T extends TFormInfo["types"]["string"]
  ? FieldTypeNullable<T, TFormInfo["types"]["null"], FieldTypeArrayable<T, TFormInfo["types"]["array"], string>>
  : T extends TFormInfo["types"]["number"]
  ? FieldTypeNullable<T, TFormInfo["types"]["null"], FieldTypeArrayable<T, TFormInfo["types"]["array"], number>>
  : T extends TFormInfo["types"]["boolean"]
  ? FieldTypeNullable<T, TFormInfo["types"]["null"], FieldTypeArrayable<T, TFormInfo["types"]["array"], boolean>>
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

type FieldValue<T extends TFormInfo["config"], TFormInfo extends FormInfoBase> = T extends { [k in DTK]: any }
  ? FieldDataTypeType<Extract<T, BaseFieldConfig>[DTK]>
  : FieldTypeType<Extract<T, TFormInfo["config"]>, TFormInfo>;

type MappedValues<T extends readonly TFormInfo["config"][], TFormInfo extends FormInfoBase> = Mutable<
  {
    [i in keyof T]: {
      [j in T[i] extends BaseFieldConfig ? T[i][NK] : EK]: T[i] extends { [k in DTK]: any }
        ? FieldDataTypeType<Extract<T[i], BaseFieldConfig>[DTK]>
        : FieldTypeType<Extract<T[i], TFormInfo["config"]>, TFormInfo>;
    };
  }
>;

type FormValue<T extends readonly TFormInfo["config"][], TFormInfo extends FormInfoBase> = UnionToIntersection<
  | Exclude<MappedValues<T, TFormInfo>[number], { [k in EK]: unknown }>
  | DeepEmptyFlatten<MappedValues<T, TFormInfo>[number]>
>;

// control utilities
type FieldControlType<T extends BaseItemConfig, TFormInfo extends FormInfoBase> = T extends BaseArrayConfig<
  TFormInfo["config"]
>
  ? ArrayControl<
      // @ts-ignore
      FormValue<T[FK], TFormInfo>,
      FormControls<T[FK], TFormInfo>,
      TFormInfo["flags"]
    >
  : T extends BaseFieldConfig
  ? T extends BaseGroupConfig<TFormInfo["config"]>
    ? GroupControl<
        // @ts-ignore
        FormValue<T[FK], TFormInfo>,
        FormControls<T[FK], TFormInfo>,
        TFormInfo["flags"]
      >
    : FieldControl<FieldValue<T, TFormInfo>, TFormInfo["flags"]>
  : ItemControl<TFormInfo["flags"]>;

type MappedControls<T extends readonly TFormInfo["config"][], TFormInfo extends FormInfoBase> = Mutable<
  {
    [i in keyof T]: {
      [j in T[i] extends BaseFieldConfig ? T[i][NK] : EK]: T[i] extends BaseFieldConfig
        ? FieldControlType<T[i], TFormInfo>
        : T[i] extends BaseGroupConfig<TFormInfo["config"]>
        ? FormControls<T[i][FK], TFormInfo>
        : never;
    };
  }
>;

type FormControls<T extends readonly TFormInfo["config"][], TFormInfo extends FormInfoBase> = UnionToIntersection<
  | Exclude<MappedControls<T, TFormInfo>[number], { [k in EK]: unknown }>
  | DeepEmptyFlatten<MappedControls<T, TFormInfo>[number]>
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
  T extends readonly TFormInfo["config"][],
  TFormInfo extends FormInfoBase,
> = GroupControl<
// @ts-ignore
  FormValue<T, TFormInfo>,
  FormControls<T, TFormInfo>,
  TFormInfo["flags"]
>;
