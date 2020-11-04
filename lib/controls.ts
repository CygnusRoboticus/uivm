import { array as AR, readonlyArray as RAR } from "fp-ts";
import { BehaviorSubject, combineLatest, Observable, of, Subscription } from "rxjs";
import { distinctUntilChanged, filter, map, shareReplay, startWith, switchMap } from "rxjs/operators";
import { AbstractFlags, Messages } from "./configs";
import { Executor } from "./executable";
import { Obj } from "./typing";
import { notNullish, toObservable } from "./utils";

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

function reduceControls<TValue, TFlags extends AbstractFlags>(controls: KeyValueControls<TValue, TFlags>) {
  return reduceChildren<TValue, TValue, TFlags>(
    controls,
    {} as TValue,
    (acc: TValue, control: FieldControl<TValue[keyof TValue], TFlags>, name: keyof TValue) => {
      acc[name] = control.value;
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
  protected _flaggers$ = new BehaviorSubject<Flagger<ItemControl<TFlags>, TFlags>[]>([() => ["hidden", false]]);
  protected _messagers$ = new BehaviorSubject<Validator<ItemControl<TFlags>>[]>([]);
  protected _initializer$ = new BehaviorSubject(false);
  protected _initialized$ = this._initializer$.pipe(filter(Boolean));

  protected get initialized() {
    return this._initializer$.getValue();
  }

  flags$: Observable<TFlags> = combineLatest([this._flaggers$, this._initialized$]).pipe(
    map(([v]) => v),
    extractSources<ItemControl<TFlags>, TFlags, [keyof TFlags, boolean]>(this),
    switchMap(v => v),
    map(
      AR.reduce({} as TFlags, (acc, [k, v]) => {
        acc[k] = (!!acc[k] || v) as TFlags[typeof k];
        return acc;
      }),
    ),
    shareReplay(),
  );

  messages$: Observable<Messages | null> = combineLatest([this._messagers$, this._initialized$]).pipe(
    map(([v]) => v),
    extractSources<ItemControl<TFlags>, TFlags, Messages | null>(this),
    switchMap(v => v),
    map(AR.filter(notNullish)),
    map(msgs => {
      if (msgs.length) {
        return msgs.reduce((acc, m) => ({ ...acc, ...m }), {});
      }
      return null;
    }),
    distinctUntilChanged(),
    shareReplay(),
  );

  constructor(opts: ItemControlOptions<TFlags> = {}) {
    super();
    if (opts.flaggers) {
      this.setFlaggers(opts.flaggers);
    }
    if (opts.messagers) {
      this.setMessagers(opts.messagers);
    }

    this.itemReady();
  }

  update() {
    this.parent?.update();
  }

  setFlaggers(flaggers: Flagger<ItemControl<TFlags>, TFlags>[]) {
    this._flaggers$.next(flaggers);
  }

  setMessagers(messagers: Validator<ItemControl<TFlags>>[]) {
    this._messagers$.next(messagers);
  }

  dispose() {
    this._messagers$.complete();
    this._flaggers$.complete();
    this._initializer$.complete();
  }

  protected itemReady() {
    this._initializer$.next(true);
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
      map(AR.map(v => toObservable(v(control)))),
      map(obs => (obs.length ? combineLatest(obs) : of([]))),
    );
}

export class FieldControl<TValue, TFlags extends AbstractFlags = AbstractFlags> extends ItemControl<TFlags> {
  value: TValue;
  protected initialValue: TValue;
  protected status: AbstractStatus;
  protected triggerSub?: Subscription;

  protected _value$: BehaviorSubject<TValue>;
  protected _status$: BehaviorSubject<AbstractStatus>;
  protected _innerStatus$: Observable<AbstractStatus>;
  protected _errors$: Observable<Messages | null>;

  protected _disablers$ = new BehaviorSubject<Disabler<FieldControl<TValue, TFlags>>[]>([]);
  protected _triggers$ = new BehaviorSubject<Trigger<FieldControl<TValue, TFlags>>[]>([]);
  protected _validators$ = new BehaviorSubject<Validator<FieldControl<TValue, TFlags>>[]>([]);

  get value$() {
    return this._value$.asObservable();
  }
  get status$() {
    return this._innerStatus$;
  }
  get errors$() {
    return this._errors$;
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

    this._value$ = new BehaviorSubject(this.value);
    this._status$ = new BehaviorSubject(this.status);

    if (opts.status) {
      this.setStatus(opts.status);
    }
    if (opts.disablers) {
      this.setDisablers(opts.disablers);
    }
    if (opts.triggers) {
      this.setTriggers(opts.triggers);
    }

    this._errors$ = combineLatest([this._validators$, this._initialized$, this._value$]).pipe(
      map(([v]) => v),
      map(AR.map(v => toObservable(v(this)).pipe(startWith(null)))),
      switchMap(obs => (obs.length ? combineLatest(obs) : of([]))),
      map(AR.filter(notNullish)),
      map(msgs => {
        if (msgs.length) {
          return msgs.reduce((acc, m) => ({ ...acc, ...m }), {});
        }
        return null;
      }),
      distinctUntilChanged(),
      shareReplay(),
    );

    this._innerStatus$ = combineLatest([this._disablers$, this._initialized$]).pipe(
      map(([v]) => v),
      extractSources<FieldControl<TValue, TFlags>, TFlags, boolean>(this),
      switchMap(v => combineLatest([this._status$, this._errors$, v])),
      map(([status, errors, disabled]) => ({
        ...status,
        valid: !errors,
        disabled: status.disabled || disabled.some(Boolean),
      })),
      shareReplay(),
    );

    this.fieldReady();
  }

  setValidators = (validators: Validator<FieldControl<TValue, TFlags>>[]) => {
    this._validators$.next(validators);
  };

  setDisabled(disabled: boolean) {
    this.setDisablers([() => disabled]);
  }

  setDisablers(disablers: Disabler<FieldControl<TValue, TFlags>>[]) {
    this._disablers$.next(disablers);
  }

  setTriggers(triggers: Trigger<FieldControl<TValue, TFlags>>[]) {
    this._triggers$.next(triggers);
  }

  setStatus = (status: Partial<AbstractStatus>) => {
    const updated = { ...this.status, ...status } as AbstractStatus;
    this.status = updated;
    this.update();
  };

  setValue = (value: TValue) => {
    this.value = value;
    const triggers = this._triggers$.getValue();
    this.executeTriggers();
    this.setStatus({ dirty: true, touched: true });
  };

  patchValue = (value: TValue) => {
    this.setValue(value);
  };

  reset = () => {
    this.value = this.initialValue;
    this.setStatus({ dirty: false, touched: false });
  };

  executeTriggers() {
    if (this.triggerSub) {
      this.triggerSub.unsubscribe();
    }
    this.triggerSub = this._triggers$
      .pipe(
        extractSources<FieldControl<TValue, TFlags>, TFlags, void>(this),
        switchMap(v => v),
      )
      .subscribe();
  }

  get(path: Array<string | number> | string): FieldControl<TValue, TFlags> | null {
    return findControl(this, path, ".");
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
    this._triggers$.complete();
    this._disablers$.complete();
    this._validators$.complete();
    this._value$.complete();
    this._status$.complete();
    super.dispose();
  }

  protected itemReady() {}
  protected fieldReady() {
    this._initializer$.next(true);
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
    super(reduceControls<TValue, TFlags>(controls), opts);
    this.value = reduceControls<TValue, TFlags>(controls);
    this.controls = controls;
    this.children.forEach(control => this.registerControl(control as TControls[keyof TControls]));

    this.groupReady();
  }

  get children() {
    return Object.values(this.controls) as FieldControl<unknown, TFlags>[];
  }

  setValue = (value: TValue) => {
    Object.keys(value).forEach(name => {
      const control = this.controls[name as keyof TValue];
      if (control) {
        control.setValue(value[name as keyof TValue] as any);
      }
    });
  };

  patchValue = (value: Partial<TValue>) => {
    Object.keys(value).forEach(k => {
      const key = k as keyof TValue;
      if (this.controls[key]) {
        this.controls[key].patchValue((value[key] as TValue[keyof TValue]) as any);
      }
    });
  };

  reset = () => this.children.forEach(control => control.reset());

  update() {
    if (!this.initialized) {
      return;
    }

    const value = reduceControls<TValue, TFlags>(this.controls);
    this.value = value;
    this._value$.next(value);
    super.update();
  }

  protected registerControl(control: ItemControl<TFlags>) {
    control.setParent(this);
  }

  protected fieldReady() {}
  protected groupReady() {
    this._initializer$.next(true);
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
    this._initializer$.next(true);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      name: "ArrayControl",
    };
  }
}
