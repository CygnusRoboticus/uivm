import { combineLatest, of } from "rxjs";
import { filter, map, switchMap, tap } from "rxjs/operators";
import { FieldControl, ItemControl } from "../src/controls";
import { BaseItemConfig } from "../src/primitives";
import { Option } from "../src/search";
import { isGroupControl } from "../src/utils";

export const registry = {
  extras: {
    static(config: BaseItemConfig, control: ItemControl, { value }: { value: unknown }) {
      return (c: ItemControl) => of(value);
    },
  },
  triggers: {
    autofill(
      config: BaseItemConfig,
      control: ItemControl,
      { field, pattern, replace }: { field: string; pattern?: RegExp | string; replace?: string },
    ) {
      const regex = pattern && replace ? (typeof pattern === "string" ? new RegExp(pattern) : pattern) : undefined;
      return (c: FieldControl<unknown>) => {
        return combineLatest([c.root$.pipe(filter(isGroupControl)), c.value$]).pipe(
          tap(([root]) => {
            const dependent = root.get(field);
            if (dependent && c.value) {
              const value = typeof c.value === "string" ? c.value : "";
              dependent.reset(regex && replace ? value.replace(regex, replace) : value);
            }
          }),
          map(() => {}),
        );
      };
    },
    alert(config: BaseItemConfig, control: ItemControl, { message }: { message: string }) {
      return (c: ItemControl) => alert(message);
    },
  },
  hints: {
    static(config: BaseItemConfig, control: ItemControl, { value }: { value: boolean }) {
      return (c: ItemControl) => of(value);
    },
    field(config: BaseItemConfig, control: ItemControl, { field, value }: { field: string; value: unknown }) {
      return (c: ItemControl) => {
        return c.root$.pipe(
          filter(isGroupControl),
          switchMap(root => {
            const dependent = root.get(field);
            if (dependent) {
              return dependent.value$.pipe(map(v => v === value));
            }
            return of(false);
          }),
        );
      };
    },
  },
  validators: {
    static(config: BaseItemConfig, control: ItemControl, { message }: { message: string }) {
      return (c: ItemControl) => of({ static: { message } });
    },
    required(config: BaseItemConfig, control: ItemControl, params?: { message?: string }) {
      return (c: FieldControl<unknown>) => {
        if (c.value === undefined || c.value === null || c.value === "" || (Array.isArray(c.value) && c.value.length)) {
          return { required: { message: params?.message || "Field is required." } };
        }
        return null;
      };
    },
  },
  search: {
    static(config: BaseItemConfig, control: ItemControl, params: { options: readonly Option[] }) {
      return {
        search: (q: string, c: ItemControl, p: object) => params.options,
        resolve: (v: any[], c: ItemControl, p: object) => params.options.filter(o => v.includes(o.value)),
      };
    },
  },
};

export type CustomRegistry = typeof registry;
