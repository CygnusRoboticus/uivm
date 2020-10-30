import { array as AR, readonlyArray as RAR } from "fp-ts";
import { BehaviorSubject, combineLatest, from, isObservable, Observable, of, Subscription } from "rxjs";
import { filter, first, map, switchMap } from "rxjs/operators";
import { AbstractFlags, Messages } from "./configs";
import { Obj } from "./typing";
import { isPromise, notNullish } from "./utils";

export type Executor<TControl extends BaseControl, TReturn> = (
  control: TControl,
) => TReturn | Promise<TReturn> | Observable<TReturn>;

type Validator<TControl extends BaseControl> = Executor<TControl, Messages | null>;
type Trigger<TControl extends BaseControl> = Executor<TControl, void>;
type Flagger<TControl extends BaseControl, TFlags extends AbstractFlags = AbstractFlags> = Executor<
  TControl,
  [keyof TFlags, boolean]
>;
type Disabler<TControl extends BaseControl> = Executor<TControl, boolean>;

function findControl<TValue, TFlags extends AbstractFlags = AbstractFlags>(
  control: FieldControl<TValue, TFlags>,
  path: (string | number)[] | string,
  delimiter = ".",
) {
  if (path == null) {
    return null;
  }

  if (!Array.isArray(path)) {
    path = path.split(delimiter);
  }
  if (Array.isArray(path) && path.length === 0) return null;
  let found: FieldControl<TValue, TFlags> | null = control;
  path.forEach((name: string | number) => {
    if (found instanceof GroupControl) {
      found = found.controls.hasOwnProperty(name) ? (found.controls[name] as FieldControl<TValue, TFlags>) : null;
    } else if (found instanceof ArrayControl) {
      found = (found.at(<number>name) as FieldControl<TValue, TFlags>) ?? null;
    } else {
      found = null;
    }
  });
  return found;
}

export interface ItemControlOptions<TFlags extends AbstractFlags = AbstractFlags> {
  status?: Partial<AbstractStatus>;
  flaggers?: Flagger<ItemControl<TFlags>, TFlags>[];
  messagers?: Validator<ItemControl<TFlags>>[];
}

export interface FieldControlOptions<TValue, TFlags extends AbstractFlags> extends ItemControlOptions<TFlags> {
  validators?: Validator<FieldControl<TValue, TFlags>>[];
  triggers?: Trigger<FieldControl<TValue, TFlags>>[];
  disablers?: Disabler<FieldControl<TValue, TFlags>>[];
}

function reduceControls<TValue, TFlags extends AbstractFlags>(
  controls: KeyValueControls<TValue, TFlags>,
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
  controls: KeyValueControls<TValue, TFlags>,
  initValue: T,
  predicate: Function,
) {
  let res = initValue;
  forEachChild<TValue, TFlags>(controls, (control, name) => {
    res = predicate(res, control, name);
  });
  return res;
}

function forEachChild<TValue extends Obj, TFlags extends AbstractFlags>(
  controls: KeyValueControls<TValue, TFlags>,
  predicate: (v: typeof controls[typeof k], k: keyof TValue) => void,
) {
  Object.keys(controls).forEach(k => {
    predicate(controls[k as keyof TValue], k);
  });
}

export interface AbstractStatus {
  valid: boolean;
  pending: boolean;
  dirty: boolean;
  touched: boolean;
  disabled: boolean;
}

export abstract class BaseControl {
  protected _parent: BaseControl | null = null;

  get parent() {
    return this._parent;
  }

  setParent(parent: BaseControl) {
    this._parent = parent;
  }

  abstract update(): void;
  abstract dispose(): void;

  toJSON() {
    return {
      parent: this.parent,
      name: "BaseControl",
    };
  }
}

export class ItemControl<TFlags extends AbstractFlags = AbstractFlags> extends BaseControl {
  protected _flaggers$ = new BehaviorSubject<Flagger<this, TFlags>[]>([() => ["hidden", false]]);
  protected _messagers$ = new BehaviorSubject<Validator<this>[]>([]);

  flags$: Observable<TFlags> = this._flaggers$.pipe(
    switchMap(obs => (obs.length ? combineLatest(obs) : of([]))),
    map(
      AR.reduce({} as TFlags, (acc, [k, v]) => {
        acc[k] = (!!acc[k] || v) as TFlags[typeof k];
        return acc;
      }),
    ),
  );

  messages$: Observable<Messages | null> = this._messagers$.pipe(
    switchMap(obs => (obs.length ? combineLatest(obs) : of([]))),
    map(AR.filter(notNullish)),
    map(msgs => {
      if (msgs.length) {
        return msgs.reduce((acc, m) => ({ ...acc, ...m }), {});
      }
      return null;
    }),
  );

  constructor(opts: ItemControlOptions<TFlags> = {}) {
    super();
    if (opts.flaggers) {
      this.setFlaggers(opts.flaggers);
    }
    if (opts.messagers) {
      this.setMessagers(opts.messagers);
    }
  }

  update() {
    this.parent?.update();
  }

  setFlaggers(flaggers: Flagger<this, TFlags>[]) {
    this._flaggers$.next(flaggers);
  }

  setMessagers(messagers: Validator<this>[]) {
    this._messagers$.next(messagers);
  }

  dispose() {
    // noop
  }

  toJSON() {
    return {
      ...super.toJSON(),
      name: "ItemControl",
    };
  }
}

function extractSources<TControl extends ItemControl<TFlags>, TFlags extends AbstractFlags, TReturn>(
  control: TControl,
) {
  return (source: Observable<Executor<TControl, TReturn>[]>) =>
    source.pipe(
      switchMap(s =>
        s.map(v => {
          const result = v(control);
          if (isPromise(result) || isObservable(result)) {
            return from(result).pipe(first());
          }
          return of(result);
        }),
      ),
    );
}

export class FieldControl<TValue, TFlags extends AbstractFlags = AbstractFlags> extends ItemControl<TFlags> {
  value: TValue;
  initialValue: TValue;
  status: AbstractStatus;
  errors: Messages | null;

  protected _value$: Observable<TValue>;
  protected _status$: Observable<AbstractStatus>;
  protected _errors$: Observable<Messages | null>;
  protected _initialized$: BehaviorSubject<boolean>;

  protected _disablers$ = new BehaviorSubject<Disabler<this>[]>([]);
  protected _triggers$ = new BehaviorSubject<Trigger<this>[]>([]);
  protected _validators$ = new BehaviorSubject<Validator<this>[]>([]);

  get value$() {
    return this._value$.asObservable();
  }
  get status$() {
    return this._status$.asObservable();
  }
  get errors$() {
    return this._errors$.asObservable();
  }
  protected get initialized() {
    return this._initialized$.getValue();
  }

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
    this.errors = <Messages | null>null;

    this._value$ = new BehaviorSubject(this.value);
    this._status$ = new BehaviorSubject(this.status);
    this._initialized$ = new BehaviorSubject<boolean>(false);

    if (opts.status) {
      this.setStatus(opts.status);
    }
    if (opts.disablers) {
      this.setDisablers(opts.disablers);
    }
    if (opts.triggers) {
      this.setTriggers(opts.triggers);
    }

    this._errors$ = combineLatest([this._initialized$.pipe(filter(Boolean)), this._value$, this._validators$]).pipe();

    this.validate();
    this.fieldReady();
  }

  setValidators = (validators: Validator<this>[]) => {
    this._validators$.next(validators);
  };

  setDisabled(disabled: boolean) {
    this.setDisablers([() => disabled]);
  }

  setDisablers(disablers: Disabler<this>[]) {
    this._disablers$.next(disablers);
  }

  setTriggers(triggers: Trigger<this>[]) {
    this._triggers$.next(triggers);
  }

  validate() {
    const sources = [];

    if (this.validationSub) {
      this.validationSub.unsubscribe();
    }
    this.validationSub = combineLatest([this._initialized$.pipe(filter(Boolean)), this._validators$])
      .pipe(
        map(([, v]) => v),
        extractSources(this),
        map(results => (results.length ? results.reduce((acc, r) => ({ ...acc, ...r }), {}) : null)),
        first(),
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
    if (!this.initialized) {
      return;
    }

    this.status = this.children.reduce(
      (acc, c) => ({
        valid: acc.valid || c.status.valid,
        disabled: acc.disabled || c.status.disabled,
        pending: acc.pending || c.status.pending,
        dirty: acc.dirty || c.status.dirty,
        touched: acc.touched || c.status.touched,
      }),
      this.status,
    );
    this._value$.next(this.value);
    this._status$.next(this.status);
    this._errors$.next(this.errors);
    super.update();
  }

  get root() {
    let x = this as FieldControl<unknown, TFlags>;

    while (x._parent) {
      x = x._parent as FieldControl<unknown, TFlags>;
    }

    return x;
  }

  get children() {
    return <FieldControl<unknown, TFlags>[]>[];
  }

  dispose() {
    this._value$.complete();
    this._errors$.complete();
    this._status$.complete();
    super.dispose();
  }

  protected fieldReady() {
    this._initialized$.next(true);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      name: "FieldControl",
    };
  }
}

export type ArrayType<T> = T extends Array<infer R> ? R : any;

export type KeyValueControls<TValue extends Obj, TFlags extends AbstractFlags> = {
  [k in keyof TValue]: FieldControl<TValue[k], TFlags>;
};

export type KeyControlsValue<TControls extends Obj> = {
  [k in keyof TControls]: TControls[k]["value"];
};

export class GroupControl<
  TValue extends KeyControlsValue<TControls>,
  TControls extends KeyValueControls<TValue, TFlags>,
  TFlags extends AbstractFlags = AbstractFlags
> extends FieldControl<TValue, TFlags> {
  constructor(public controls: TControls, opts: FieldControlOptions<TValue, TFlags> = {}) {
    super(reduceControls<TValue, TFlags>(controls, opts.status?.disabled ?? false), opts);
    this.value = reduceControls<TValue, TFlags>(controls, opts.status?.disabled ?? false);
    this.controls = controls;
    this.children.forEach(control => this.registerControl(control as TControls[keyof TControls]));

    this.setValue = (value: TValue) => {
      Object.keys(value).forEach(name => {
        const control = this.controls[name as keyof TValue];
        if (control) {
          control.setValue(value[name as keyof TValue] as any);
        }
      });
    };
    this.patchValue = (value: Partial<TValue>) => {
      Object.keys(value).forEach(k => {
        const key = k as keyof TValue;
        if (this.controls[key]) {
          this.controls[key].patchValue((value[key] as TValue[keyof TValue]) as any);
        }
      });
    };
    this.reset = () => this.children.forEach(control => control.reset());
    this.groupReady();
  }

  get children() {
    return Object.values(this.controls) as FieldControl<unknown, TFlags>[];
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
        acc: KeyValueControls<TValue, TFlags>,
        control: FieldControl<TValue[keyof TValue], TFlags>,
        name: keyof TValue,
      ) => {
        acc[name] = control instanceof FieldControl ? control.value : (<any>control).getRawValue();
        return acc;
      },
    );
  }

  update() {
    if (!this.initialized) {
      return;
    }

    const value = reduceControls<TValue, TFlags>(this.controls, this.status.disabled);
    this.value = value;
    this._value$.next(value);
    super.update();
  }

  protected registerControl(control: ItemControl<TFlags>) {
    control.setParent(this);
  }

  protected fieldReady() {}
  protected groupReady() {
    this._initialized$.next(true);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      name: "GroupControl",
    };
  }
}

export class ArrayControl<
  TValue extends KeyControlsValue<TControls>,
  TControls extends KeyValueControls<TValue, TFlags>,
  TFlags extends AbstractFlags = AbstractFlags
> extends FieldControl<TValue[], TFlags> {
  controls: ReturnType<this["itemFactory"]>[];

  get itemFactory() {
    return this._itemFactory;
  }

  constructor(
    protected _itemFactory: (value: TValue | null) => GroupControl<TValue, TControls, TFlags>,
    value: TValue[] = [],
    opts: FieldControlOptions<TValue[], TFlags> = {},
  ) {
    super(value, opts);
    this.controls = value.map(v => this.itemFactory(v) as ReturnType<this["itemFactory"]>);
    this.children.forEach(control => this.registerControl(control));
    this.arrayReady();
  }

  get length() {
    return this.controls.length;
  }

  get children() {
    return this.controls as FieldControl<unknown, TFlags>[];
  }

  at(index: number) {
    return this.controls[index];
  }

  push(...items: ReturnType<this["itemFactory"]>[]) {
    this.controls.push(...items);
    items.map(control => this.registerControl(control));
  }

  insert(index: number, item: ReturnType<this["itemFactory"]>) {
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
    this.controls.forEach(control => control.reset());
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
    if (!this.initialized) {
      return;
    }

    const value = this.controls.map(control => control.value);
    this.value = value;
    this._value$.next(value);
    super.update();
  }

  protected resize(length: number) {
    this.clear();
    const controls = RAR.range(0, length - 1).map(
      (_, i) => this.itemFactory(this.value[i] ?? null) as ReturnType<this["itemFactory"]>,
    );
    this.push(...controls);
  }

  protected registerControl(control: ItemControl<TFlags>) {
    control.setParent(this);
  }

  protected fieldReady() {}
  protected arrayReady() {
    this._initialized$.next(true);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      name: "ArrayControl",
    };
  }
}
