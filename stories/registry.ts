import { of } from "rxjs";
import { map, tap } from "rxjs/operators";
import { FieldConfig, ItemConfig } from "../lib/configs";
import { FieldControl, ItemControl } from "../lib/controls";
import { BaseItemConfig } from "../lib/primitives";

export const registry = {
  messagers: {
    static(config: ItemConfig<any, any>, control: ItemControl<any>, { message }: { message: string }) {
      return (c: any) => of({ static: { message } });
    },
  },
  triggers: {
    autofill(
      config: BaseItemConfig,
      control: FieldControl<any, any>,
      { field, pattern, replace }: { field: string; pattern?: RegExp | string; replace?: string },
    ) {
      const regex = pattern && replace ? (typeof pattern === "string" ? new RegExp(pattern) : pattern) : undefined;
      return (c: any) =>
        control.value$.pipe(
          tap(() => {
            const dependent = control.root.get(field);
            console.log({ field, pattern, replace, dependent });
            if (dependent) {
              const value = typeof control.value === "string" ? control.value : "";
              dependent.setValue(regex && replace ? value.replace(regex, replace) : value);
            }
          }),
          map(() => {}),
        );
    },
    alert(config: any, control: any, { message }: { message: string }) {
      return () => alert(message);
    },
  },
  flags: {
    static(config: any, control: any, { value }: { value: boolean }) {
      return (c: any) => of(value);
    },
    field(config: any, control: any, { field, value }: { field: string; value: unknown }) {
      return () => {
        const root = control.root;
        const dependent = root.get(field);
        if (dependent) {
          return dependent.value$.pipe(map(v => v === value));
        }
        return false;
      };
    },
  },
  validators: {
    required(config: FieldConfig<any, any>, control: FieldControl<any>, params?: { message?: string }) {
      return (c: FieldControl<any, any>) => {
        if (c.value === undefined || c.value === null || c.value === "" || (Array.isArray(c.value) && c.value.length)) {
          return { required: { message: params.message || "Field is required." } };
        }
        return null;
      };
    },
  },
  search: {},
};

export type CustomRegistry = typeof registry;
