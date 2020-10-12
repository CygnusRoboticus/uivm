import { range } from "fp-ts/lib/ReadonlyArray";
import { BehaviorSubject, combineLatest, from, isObservable, Observable, of, Subscription } from "rxjs";
import { map, scan, switchMap, take, throwIfEmpty } from "rxjs/operators";
import { FieldConfig, FormItemConfig, GroupConfig } from "./configs";

export type ValidationErrors = {
  [key: string]: any;
};

export interface ValidatorFn<TValue, TStatus extends AbstractStatus> {
  (control: FieldControl<TValue, TStatus>): ValidationErrors | null;
}

export interface AsyncValidatorFn<TValue, TStatus extends AbstractStatus> {
  (control: FieldControl<TValue, TStatus>): Promise<ValidationErrors | null> | Observable<ValidationErrors | null>;
}

function findControl<TValue, TStatus extends AbstractStatus>(
  control: FieldControl<TValue, TStatus>,
  path: (string | number)[] | string,
  delimiter = ".",
) {
  if (path == null) return null;

  if (!Array.isArray(path)) {
    path = path.split(delimiter);
  }
  if (Array.isArray(path) && path.length === 0) return null;
  let controlToFind: FieldControl<TValue, TStatus> | null = control;
  path.forEach((name: string | number) => {
    if (controlToFind instanceof GroupControl) {
      controlToFind = controlToFind.controls.hasOwnProperty(name) ? controlToFind.controls[name] : null;
    } else if (controlToFind instanceof ArrayControl) {
      // TODO: fix!
      // controlToFind = controlToFind.at(<number>name) ?? null;
    } else {
      controlToFind = null;
    }
  });
  return controlToFind;
}

export interface ItemControlOptions<TStatus extends AbstractStatus> {
  status?: Partial<TStatus>;
}

export interface FieldControlOptions<TValue, TStatus extends AbstractStatus> extends ItemControlOptions<TStatus> {
  validators?: ValidatorFn<TValue, TStatus>[] | null;
  asyncValidators?: AsyncValidatorFn<TValue, TStatus>[] | null;
}

export function vectorize<T>(value: T | T[] | null | undefined) {
  return value === null || value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function itemsToControls<TValue, TStatus extends AbstractStatus>(items: ItemControl<TStatus>[]) {
  return items.reduce((acc, control) => {
    if (control instanceof FieldControl && !acc[control.name as keyof TValue]) {
      acc[control.name as keyof TValue] = control;
    }
    return acc;
  }, {} as FieldControlMap<TValue, TStatus>);
}

function reduceControls<TValue, TStatus extends AbstractStatus>(
  controls: FieldControlMap<TValue, TStatus>,
  disabled: boolean,
) {
  return reduceChildren<TValue, TValue, TStatus>(
    controls,
    {} as TValue,
    (acc: TValue, control: FieldControl<TValue[keyof TValue], TStatus>, name: keyof TValue) => {
      if (!control.status.disabled || disabled) {
        acc[name] = control.value;
      }
      return acc;
    },
  );
}

function reduceChildren<T, TValue, TStatus extends AbstractStatus>(
  controls: FieldControlMap<TValue, TStatus>,
  initValue: T,
  predicate: Function,
) {
  let res = initValue;
  forEachChild<TValue, TStatus>(controls, (control, name) => {
    res = predicate(res, control, name);
  });
  return res;
}

function forEachChild<TValue, TStatus extends AbstractStatus>(
  controls: FieldControlMap<TValue, TStatus>,
  predicate: (v: FieldControl<TValue[keyof TValue], TStatus>, k: keyof TValue) => void,
) {
  Object.keys(controls).forEach(k => {
    const key = k as keyof TValue;
    predicate(controls[key], key);
  });
}

function notNullish<T>(value: T | null | undefined): value is T {
  return !!value;
}

interface AbstractStatus {
  valid: boolean;
  disabled: boolean;
  pending: boolean;
  dirty: boolean;
  touched: boolean;
  visible: boolean;
  [key: string]: boolean;
}

export class ItemControl<TStatus extends AbstractStatus> {
  status: TStatus;
  status$: BehaviorSubject<TStatus>;
  protected _parent: ItemControl<TStatus> | null = null;

  get children() {
    return <ItemControl<TStatus>[]>[];
  }

  get parent() {
    return this._parent;
  }

  constructor(opts: { status?: Partial<TStatus> } = { status: {} }) {
    this.status = {
      valid: true,
      disabled: false,
      pending: false,
      dirty: false,
      touched: false,
      visible: true,
      ...opts.status,
    } as TStatus;

    this.status$ = new BehaviorSubject(this.status);
  }

  update() {
    this.status$.next(this.status);
    this.parent?.update();
  }

  setStatus = (status: Partial<TStatus>, opts: { includeChildren?: boolean } = {}) => {
    this.setStatusSilent(status, opts);
    this.update();
  };

  protected setStatusSilent = (status: Partial<TStatus>, opts: { includeChildren?: boolean } = {}) => {
    const updated = { ...this.status, ...status } as TStatus;
    this.status = updated;
    if (opts.includeChildren) {
      this.children.forEach(control => control.setStatus(status));
    }
  };

  setParent(parent: ItemControl<TStatus>) {
    this._parent = parent;
  }
}

export class FieldControl<TValue, TStatus extends AbstractStatus> extends ItemControl<TStatus> {
  name: string;
  value: TValue;
  initialValue: TValue;
  errors: ValidationErrors | null;

  value$: BehaviorSubject<TValue>;
  errors$: BehaviorSubject<ValidationErrors | null>;

  protected validators: ValidatorFn<TValue, TStatus>[];
  protected asyncValidators: AsyncValidatorFn<TValue, TStatus>[];
  protected validationSub?: Subscription;

  constructor(name: string, value: TValue, opts: FieldControlOptions<TValue, TStatus> = {}) {
    super(opts);
    this.name = name;
    this.value = value;
    this.initialValue = value;
    this.errors = <ValidationErrors | null>null;

    this.validators = opts.validators ?? [];
    this.asyncValidators = opts.asyncValidators ?? [];

    this.value$ = new BehaviorSubject(this.value);
    this.errors$ = new BehaviorSubject(this.errors);
  }

  setValidators = (validators: ValidatorFn<TValue, TStatus>[]) => {
    this.validators = validators;
    this.validate();
  };

  setAsyncValidators = (validators: AsyncValidatorFn<TValue, TStatus>[]) => {
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
        this.setStatus({ valid: !!errors } as Partial<TStatus>);
      });
  }

  setValue = (value: TValue) => {
    this.value = value;
    this.setStatus({ dirty: true, touched: true } as Partial<TStatus>);
  };

  patchValue = (value: TValue) => {
    this.setValue(value);
  };

  reset = () => {
    this.value = this.initialValue;
    this.setStatus({ dirty: false, touched: false } as Partial<TStatus>);
  };

  get(path: Array<string | number> | string): FieldControl<TValue, TStatus> | null {
    return findControl(this, path, ".");
  }

  getError(errorCode: string, path?: Array<string | number> | string): any {
    const control = path ? this.get(path) : this;
    return control && control.errors ? control.errors[errorCode] : null;
  }

  update() {
    this.value$.next(this.value);
    this.errors$.next(this.errors);
    super.update();
  }

  get root() {
    let x = this as FieldControl<unknown, TStatus>;

    while (x._parent) {
      x = x._parent as FieldControl<unknown, TStatus>;
    }

    return x;
  }
}

type FieldControlMap<TValue, TStatus extends AbstractStatus> = {
  [key in keyof TValue]: FieldControl<TValue[key], TStatus>;
};

export class GroupControl<TValue, TStatus extends AbstractStatus> extends FieldControl<TValue, TStatus> {
  public items: ItemControl<TStatus>[];
  public controls: FieldControlMap<TValue, TStatus>;

  constructor(name: string, items: ItemControl<TStatus>[], opts: FieldControlOptions<TValue, TStatus> = {}) {
    const controls = itemsToControls<TValue, TStatus>(items);
    super(name, reduceControls<TValue, TStatus>(controls, opts.status?.disabled ?? false), opts);
    this.items = items;
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
    return this.controls.hasOwnProperty(key) && this.controls[key].status.enabled;
  }

  setValue: (value: TValue) => void;
  patchValue: (value: Partial<TValue>) => void;
  reset: () => void;

  getRawValue() {
    return reduceChildren(
      this.controls,
      {},
      (
        acc: FieldControlMap<TValue, TStatus>,
        control: FieldControl<TValue[keyof TValue], TStatus>,
        name: keyof TValue,
      ) => {
        acc[name] = control instanceof FieldControl ? control.value : (<any>control).getRawValue();
        return acc;
      },
    );
  }

  update() {
    const value = reduceControls<TValue, TStatus>(this.controls, this.status.disabled);
    this.value = value;
    this.value$.next(value);
    super.update();
  }

  protected registerControl(control: ItemControl<TStatus>) {
    control.setParent(this);
  }
}

export class ArrayControl<
  TValue,
  TControls extends ItemControl<TStatus>[],
  TStatus extends AbstractStatus
> extends FieldControl<TValue[], TStatus> {
  public items: TControls[];
  public controls: FieldControlMap<TValue, TStatus>[];

  constructor(
    name: string,
    value: TValue[],
    opts: FieldControlOptions<TValue[], TStatus> = {},
    protected itemFactory: (value: TValue | null) => TControls,
  ) {
    super(name, value, opts);
    this.items = value.map(v => itemFactory(v));
    this.controls = this.items.map<FieldControlMap<TValue, TStatus>>(itemsToControls);
    this.children.forEach(control => this.registerControl(control));
  }

  get children() {
    return this.items.reduce((acc, items) => {
      acc.push(...items);
      return acc;
    }, <ItemControl<TStatus>[]>[]);
  }

  get length(): number {
    return this.controls.length;
  }

  at(index: number) {
    return this.controls[index];
  }

  push(...items: TControls[]) {
    this.items.push(...items);
    this.controls.push(...items.map<FieldControlMap<TValue, TStatus>>(itemsToControls));
    items.forEach(controls => controls.map(control => this.registerControl(control)));
  }

  insert(index: number, items: TControls) {
    this.items.splice(index, 0, items);
    this.controls.splice(index, 0, itemsToControls(items));

    items.map(control => this.registerControl(control));
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

    value.forEach((newValue, index) => {
      const control = this.at(index);
      if (control && control instanceof FieldControl) {
        if (control instanceof GroupControl) {
          control.patchValue(newValue);
        } else {
          control.setValue(newValue as TValue);
        }
      }
    });
  };

  reset = () => {
    this.resize(this.initialValue.length);
    this.children.forEach(control => {
      if (control instanceof FieldControl) {
        control.reset();
      }
    });
  };

  getRawValue(): TValue[] {
    return this.controls.map(control => {
      return control instanceof FieldControl ? control.value : (<any>control).getRawValue();
    });
  }

  clear() {
    this.controls.splice(0);
    this.setStatus({ dirty: true, touched: true } as Partial<TStatus>);
  }

  update() {
    // TODO: fix;
    // const value = this.controls
    //   .filter(control => control.status.enabled || this.status.disabled)
    //   .map(control => control.value);
    // this.value = value;
    // this.value$.next(value);
    super.update();
  }

  protected resize(length: number) {
    this.clear();
    const controls = range(0, length).map((_, i) => this.itemFactory(this.value[i] ?? null));
    this.push(...controls);
  }

  protected registerControl(control: ItemControl<TStatus>) {
    control.setParent(this);
  }
}
