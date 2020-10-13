import { array as AR } from "fp-ts";
import { groupBy } from "fp-ts/lib/NonEmptyArray";
import { range } from "fp-ts/lib/ReadonlyArray";
import { BehaviorSubject, combineLatest, from, Observable, of, Subject, Subscription } from "rxjs";
import { map, take } from "rxjs/operators";

export type ValidationErrors = {
  [key: string]: { message: string; [k: string]: unknown };
};

export interface ValidatorFn<TValue, TFlags extends AbstractFlags> {
  (control: FieldControl<TValue, TFlags>): ValidationErrors | null;
}

export interface AsyncValidatorFn<TValue, TFlags extends AbstractFlags> {
  (control: FieldControl<TValue, TFlags>): Promise<ValidationErrors | null> | Observable<ValidationErrors | null>;
}

function findControl<TValue, TFlags extends AbstractFlags>(
  control: FieldControl<TValue, TFlags>,
  path: (string | number)[] | string,
  delimiter = ".",
) {
  if (path == null) return null;

  if (!Array.isArray(path)) {
    path = path.split(delimiter);
  }
  if (Array.isArray(path) && path.length === 0) return null;
  let found: FieldControl<TValue, TFlags> | null = control;
  path.forEach((name: string | number) => {
    if (found instanceof GroupControl) {
      found = found.controls.hasOwnProperty(name) ? found.controls[name] : null;
    } else if (found instanceof ArrayControl) {
      found = found.at(<number>name) ?? null;
    } else {
      found = null;
    }
  });
  return found;
}

export interface ItemControlOptions<TFlags extends AbstractFlags> {
  status?: Partial<TFlags>;
  flags?: Partial<TFlags>;
  flagExecutors?: Observable<[keyof TFlags, boolean]>[];
}

export interface FieldControlOptions<TValue, TFlags extends AbstractFlags> extends ItemControlOptions<TFlags> {
  validators?: ValidatorFn<TValue, TFlags>[] | null;
  asyncValidators?: AsyncValidatorFn<TValue, TFlags>[] | null;
}

export function vectorize<T>(value: T | T[] | null | undefined) {
  return value === null || value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function reduceControls<TValue, TFlags extends AbstractFlags>(
  controls: FieldControlMap<TValue, TFlags>,
  disabled: boolean,
) {
  return reduceChildren<TValue, TValue, TFlags>(
    controls,
    {} as TValue,
    (acc: TValue, control: FieldControl<TValue[keyof TValue], TFlags>, name: keyof TValue) => {
      if (!control.status.disabled || disabled) {
        acc[name] = control.value;
      }
      return acc;
    },
  );
}

function reduceChildren<T, TValue, TFlags extends AbstractFlags>(
  controls: FieldControlMap<TValue, TFlags>,
  initValue: T,
  predicate: Function,
) {
  let res = initValue;
  forEachChild<TValue, TFlags>(controls, (control, name) => {
    res = predicate(res, control, name);
  });
  return res;
}

function forEachChild<TValue, TFlags extends AbstractFlags>(
  controls: FieldControlMap<TValue, TFlags>,
  predicate: (v: FieldControl<TValue[keyof TValue], TFlags>, k: keyof TValue) => void,
) {
  Object.keys(controls).forEach(k => {
    const key = k as keyof TValue;
    predicate(controls[key], key);
  });
}

function notNullish<T>(value: T | null | undefined): value is T {
  return !!value;
}

export interface AbstractStatus {
  valid: boolean;
  pending: boolean;
  dirty: boolean;
  touched: boolean;
  disabled: boolean;
}

export interface AbstractFlags {
  visible: boolean;
  [key: string]: boolean;
}

export class ItemControl<TFlags extends AbstractFlags> {
  flags: TFlags;
  flags$: BehaviorSubject<TFlags>;
  protected _flagExecutor: Observable<TFlags> = new Subject();
  protected _parent: ItemControl<TFlags> | null = null;

  get parent() {
    return this._parent;
  }

  constructor(opts: ItemControlOptions<TFlags> = { flags: {} }) {
    this.flags = {
      visible: true,
      ...opts.flags,
    } as TFlags;
    this.flags$ = new BehaviorSubject<TFlags>(this.flags);
    this.setFlagExecutors(opts.flagExecutors ?? []);
  }

  update() {
    this.flags$.next(this.flags);
    this.parent?.update();
  }

  setFlags = (flags: Partial<TFlags>) => {
    const updated = { ...this.flags, ...flags } as TFlags;
    this.flags = updated;
    this.update();
  };

  setFlagExecutors(observables: Observable<[keyof TFlags, boolean]>[]) {
    this._flagExecutor = combineLatest(observables)
      .pipe(
        map(groupBy(([k]) => k as string)),
        map<{}, [keyof TFlags, TFlags[keyof TFlags]][]>(Object.entries),
        map(
          AR.reduce({} as TFlags, (acc, [k, v]) => {
            acc[k] = acc[k] && v;
            return acc;
          }),
        ),
      )
      .subscribe(flags => this.flags$.next(flags));
  }

  setParent(parent: ItemControl<TFlags>) {
    this._parent = parent;
  }

  dispose() {
    this.flags$.complete();
  }
}

export class FieldControl<TValue, TFlags extends AbstractFlags> extends ItemControl<TFlags> {
  value: TValue;
  initialValue: TValue;
  status: AbstractStatus;
  errors: ValidationErrors | null;

  value$: BehaviorSubject<TValue>;
  status$: BehaviorSubject<AbstractStatus>;
  errors$: BehaviorSubject<ValidationErrors | null>;

  protected validators: ValidatorFn<TValue, TFlags>[];
  protected asyncValidators: AsyncValidatorFn<TValue, TFlags>[];
  protected validationSub?: Subscription;

  constructor(value: TValue, opts: FieldControlOptions<TValue, TFlags> = {}) {
    super(opts);
    this.value = value;
    this.initialValue = value;
    this.status = {
      valid: true,
      disabled: false,
      pending: false,
      dirty: false,
      touched: false,
    };
    this.errors = <ValidationErrors | null>null;

    this.validators = opts.validators ?? [];
    this.asyncValidators = opts.asyncValidators ?? [];

    this.value$ = new BehaviorSubject(this.value);
    this.status$ = new BehaviorSubject(this.status);
    this.errors$ = new BehaviorSubject(this.errors);
  }

  setValidators = (validators: ValidatorFn<TValue, TFlags>[]) => {
    this.validators = validators;
    this.validate();
  };

  setAsyncValidators = (validators: AsyncValidatorFn<TValue, TFlags>[]) => {
    this.asyncValidators = validators;
    this.validate();
  };

  validate() {
    const results = this.validators.map(v => v(this)).filter(notNullish);
    const asyncObs = combineLatest(this.asyncValidators.map(v => from(v(this)).pipe(take(1)))).pipe(
      map(results => results.filter(notNullish)),
    );
    if (this.validationSub) {
      this.validationSub.unsubscribe();
    }
    this.validationSub = combineLatest([of(results), asyncObs])
      .pipe(
        map(([results, asyncResults]) => [...results, ...asyncResults]),
        map(results => (results.length ? results.reduce((acc, r) => ({ ...acc, ...r }), {}) : null)),
        take(1),
      )
      .subscribe(errors => {
        this.errors = errors;
        this.setStatus({ valid: !!errors });
      });
  }

  setStatus = (status: Partial<AbstractStatus>) => {
    const updated = { ...this.status, ...status } as AbstractStatus;
    this.status = updated;
    this.update();
  };

  setValue = (value: TValue) => {
    this.value = value;
    this.setStatus({ dirty: true, touched: true });
  };

  patchValue = (value: TValue) => {
    this.setValue(value);
  };

  reset = () => {
    this.value = this.initialValue;
    this.setStatus({ dirty: false, touched: false });
  };

  get(path: Array<string | number> | string): FieldControl<TValue, TFlags> | null {
    return findControl(this, path, ".");
  }

  getError(errorCode: string, path?: Array<string | number> | string): any {
    const control = path ? this.get(path) : this;
    return control && control.errors ? control.errors[errorCode] : null;
  }

  update() {
    this.value$.next(this.value);
    this.status$.next(this.status);
    this.errors$.next(this.errors);
    super.update();
  }

  get root() {
    let x = this as FieldControl<unknown, TFlags>;

    while (x._parent) {
      x = x._parent as FieldControl<unknown, TFlags>;
    }

    return x;
  }

  dispose() {
    this.value$.complete();
    this.errors$.complete();
    super.dispose();
  }
}

type FieldControlMap<TValue, TFlags extends AbstractFlags> = {
  [key in keyof TValue]: FieldControl<TValue[key], TFlags>;
};

export class GroupControl<TValue, TFlags extends AbstractFlags> extends FieldControl<TValue, TFlags> {
  public controls: FieldControlMap<TValue, TFlags>;

  constructor(controls: FieldControlMap<TValue, TFlags>, opts: FieldControlOptions<TValue, TFlags> = {}) {
    super(reduceControls<TValue, TFlags>(controls, opts.status?.disabled ?? false), opts);
    this.controls = controls;
    this.children.forEach(control => this.registerControl(control));

    this.setValue = (value: TValue) => {
      Object.keys(value).forEach(name => {
        this.controls[name as keyof TValue].setValue(value[name as keyof TValue]);
      });
    };
    this.patchValue = (value: Partial<TValue>) => {
      Object.keys(value).forEach(k => {
        const key = k as keyof TValue;
        if (this.controls[key]) {
          this.controls[key].patchValue(value[key] as TValue[keyof TValue]);
        }
      });
    };
    this.reset = () => {
      this.children.forEach(control => control.reset());
    };
  }

  get children() {
    return Object.keys(this.controls).map(k => {
      const key = k as keyof TValue;
      return this.controls[key];
    });
  }

  contains(controlName: string) {
    const key = controlName as keyof TValue;
    return this.controls.hasOwnProperty(key) && !this.controls[key].status.disabled;
  }

  setValue: (value: TValue) => void;
  patchValue: (value: Partial<TValue>) => void;
  reset: () => void;

  getRawValue() {
    return reduceChildren(
      this.controls,
      {},
      (
        acc: FieldControlMap<TValue, TFlags>,
        control: FieldControl<TValue[keyof TValue], TFlags>,
        name: keyof TValue,
      ) => {
        acc[name] = control instanceof FieldControl ? control.value : (<any>control).getRawValue();
        return acc;
      },
    );
  }

  update() {
    const value = reduceControls<TValue, TFlags>(this.controls, this.status.disabled);
    this.value = value;
    this.value$.next(value);
    super.update();
  }

  protected registerControl(control: ItemControl<TFlags>) {
    control.setParent(this);
  }
}

export class ArrayControl<
  TValue,
  TItem extends GroupControl<TValue, TFlags>,
  TFlags extends AbstractFlags
> extends FieldControl<TValue[], TFlags> {
  public controls: TItem[];

  constructor(
    protected itemFactory: (value: TValue | null) => TItem,
    value: TValue[] = [],
    opts: FieldControlOptions<TValue[], TFlags> = {},
  ) {
    super(value, opts);
    this.controls = value.map(v => itemFactory(v));
    this.children.forEach(control => this.registerControl(control));
  }

  get children() {
    return this.controls;
  }

  get length() {
    return this.controls.length;
  }

  at(index: number) {
    return this.controls[index];
  }

  push(...items: TItem[]) {
    this.controls.push(...items);
    items.map(control => this.registerControl(control));
  }

  insert(index: number, item: TItem) {
    this.controls.splice(index, 0, item);
    this.registerControl(item);
  }

  removeAt(index: number) {
    this.controls.splice(index, 1);
  }

  setValue = (value: TValue[]) => {
    this.resize(value.length);
    value.forEach((newValue, index) => {
      const control = this.at(index);
      if (control && control instanceof FieldControl) {
        control.setValue(newValue);
      }
    });
  };

  patchValue = (value: Partial<TValue>[]) => {
    this.resize(value.length);

    value.forEach((v, index) => {
      const control = this.at(index);
      control?.patchValue(v);
    });
  };

  reset = () => {
    this.resize(this.initialValue.length);
    this.children.forEach(control => control.reset());
  };

  getRawValue(): TValue[] {
    return this.controls.map(control => {
      return control instanceof FieldControl ? control.value : (<any>control).getRawValue();
    });
  }

  clear() {
    this.controls.splice(0);
    this.setStatus({ dirty: true, touched: true });
  }

  update() {
    const value = this.controls.map(control => control.value);
    this.value = value;
    this.value$.next(value);
    super.update();
  }

  protected resize(length: number) {
    this.clear();
    const controls = range(0, length).map((_, i) => this.itemFactory(this.value[i] ?? null));
    this.push(...controls);
  }

  protected registerControl(control: ItemControl<TFlags>) {
    control.setParent(this);
  }
}
