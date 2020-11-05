import { array as AR, readonlyArray as RAR } from "fp-ts";
import { BehaviorSubject, combineLatest, of, Subscription } from "rxjs";
import { catchError, distinctUntilChanged, filter, finalize, first, map, switchMap, tap } from "rxjs/operators";
import { AbstractFlags, Messages } from "./configs";
import { Executor, ObservableExecutor } from "./executable";
import { Obj } from "./typing";
import { notNullish, toObservable } from "./utils";

type Validator<TControl extends BaseControl> = Executor<TControl, Messages | null>;
type Trigger<TControl extends BaseControl> = Executor<TControl, void>;
type Flagger<TControl extends BaseControl, TFlags extends AbstractFlags = AbstractFlags> = ObservableExecutor<
  TControl,
  [keyof TFlags, boolean]
>;
type Disabler<TControl extends BaseControl> = ObservableExecutor<TControl, boolean>;

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
  flaggers?: Flagger<ItemControl<TFlags>, TFlags>[];
  messagers?: Validator<ItemControl<TFlags>>[];
}

export interface FieldControlOptions<TValue, TFlags extends AbstractFlags> extends ItemControlOptions<TFlags> {
  dirty?: boolean;
  touched?: boolean;
  disabled?: boolean;

  triggers?: Trigger<FieldControl<TValue, TFlags>>[];
  disablers?: Disabler<FieldControl<TValue, TFlags>>[];
  validators?: Validator<FieldControl<TValue, TFlags>>[];
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

  get parent(): BaseControl | null {
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
  protected _flags$ = new BehaviorSubject({} as TFlags);
  protected _messages$ = new BehaviorSubject<Messages | null>(null);

  protected flaggers: Flagger<ItemControl<TFlags>, TFlags>[] = [];
  protected messagers: Validator<ItemControl<TFlags>>[] = [];

  protected flagsSub?: Subscription;
  protected messagesSub?: Subscription;

  get flags() {
    return this._flags$.getValue();
  }
  get messages() {
    return this._messages$.getValue();
  }

  get flags$() {
    return this._flags$.asObservable();
  }
  get messages$() {
    return this._messages$.pipe(distinctUntilChanged());
  }

  protected _initializer$ = new BehaviorSubject(false);
  protected _initialized$ = this._initializer$.pipe(filter(Boolean));
  protected get initialized() {
    return this._initializer$.getValue();
  }

  updateFlags() {
    this.flagsSub?.unsubscribe();
    this.flagsSub = this._initialized$
      .pipe(
        switchMap(() => extractSources<ItemControl<TFlags>, TFlags, [keyof TFlags, boolean]>(this, this.flaggers)),
        map(flgs =>
          flgs.reduce((acc, [k, v]) => {
            acc[k] = (!!acc[k] || v) as TFlags[typeof k];
            return acc;
          }, {} as TFlags),
        ),
      )
      .subscribe(flags => this._flags$.next(flags));
  }

  updateMessages() {
    this.messagesSub?.unsubscribe();
    this.messagesSub = this._initialized$
      .pipe(
        switchMap(() => extractSources<ItemControl<TFlags>, TFlags, Messages | null>(this, this.messagers)),
        map(AR.filter(notNullish)),
        map(msgs => (msgs.length ? msgs.reduce((acc, m) => ({ ...acc, ...m }), {}) : null)),
        distinctUntilChanged(),
      )
      .subscribe(messages => this._messages$.next(messages));
  }

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
    if (!this.initialized) {
      return;
    }

    this.parent?.update();
  }

  setFlaggers(flaggers: Flagger<ItemControl<TFlags>, TFlags>[]) {
    this.flaggers = flaggers;
    this.updateFlags();
  }

  setMessagers(messagers: Validator<ItemControl<TFlags>>[]) {
    this.messagers = messagers;
    this.updateMessages();
  }

  dispose() {
    this.flagsSub?.unsubscribe();
    this.messagesSub?.unsubscribe();

    this._flags$.complete();
    this._messages$.complete();
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
  executors: Executor<TControl, TReturn>[],
) {
  const obs = executors.map(v => toObservable(v(control)));
  return obs.length ? combineLatest(obs) : of([]);
}

export class FieldControl<TValue, TFlags extends AbstractFlags = AbstractFlags> extends ItemControl<TFlags> {
  protected initialValue: TValue;
  protected _parent: FieldControl<unknown, TFlags> | null = null;

  protected _value$: BehaviorSubject<TValue>;
  protected _disabled$ = new BehaviorSubject(false);
  protected _pending$ = new BehaviorSubject(false);
  protected _dirty$ = new BehaviorSubject(false);
  protected _touched$ = new BehaviorSubject(false);
  protected _errors$ = new BehaviorSubject<Messages | null>(null);
  protected _enabled$ = this._disabled$.pipe(
    map(v => !v),
    filter(Boolean),
  );

  protected _childrenValid$ = new BehaviorSubject(true);
  protected _childrenDirty$ = new BehaviorSubject(false);
  protected _childrenPending$ = new BehaviorSubject(false);
  protected _childrenTouched$ = new BehaviorSubject(false);
  protected _parentDisabled$ = new BehaviorSubject(false);

  protected triggers: Trigger<FieldControl<TValue, TFlags>>[] = [];
  protected disablers: Disabler<FieldControl<TValue, TFlags>>[] = [];
  protected validators: Validator<FieldControl<TValue, TFlags>>[] = [];

  protected triggerSub?: Subscription;
  protected disablerSub?: Subscription;
  protected validatorSub?: Subscription;

  get value() {
    return this._value$.getValue();
  }
  get disabled() {
    return this._disabled$.getValue() || this._parentDisabled$.getValue();
  }
  get valid() {
    return !this._errors$.getValue() && this._childrenValid$.getValue();
  }
  get pending() {
    return this._pending$.getValue() || this._childrenPending$.getValue();
  }
  get dirty() {
    return this._dirty$.getValue() || this._childrenDirty$.getValue();
  }
  get touched() {
    return this._touched$.getValue() || this._childrenTouched$.getValue();
  }
  get errors() {
    return this._errors$.getValue();
  }

  get value$() {
    return this._value$.pipe(distinctUntilChanged());
  }
  get disabled$() {
    return combineLatest([this._disabled$, this._parentDisabled$]).pipe(
      map(([d, pd]) => d || pd),
      distinctUntilChanged(),
    );
  }
  get valid$() {
    return combineLatest([this._errors$, this._childrenValid$]).pipe(
      map(([e, cv]) => !e && cv),
      distinctUntilChanged(),
    );
  }
  get pending$() {
    return combineLatest([this._pending$, this._childrenPending$]).pipe(
      map(([p, cp]) => p || cp),
      distinctUntilChanged(),
    );
  }
  get dirty$() {
    return combineLatest([this._dirty$, this._childrenDirty$]).pipe(
      map(([d, cd]) => d || cd),
      distinctUntilChanged(),
    );
  }
  get touched$() {
    return combineLatest([this._touched$, this._childrenTouched$]).pipe(
      map(([t, ct]) => t || ct),
      distinctUntilChanged(),
    );
  }
  get errors$() {
    return this._errors$.pipe(distinctUntilChanged());
  }

  constructor(value: TValue, opts: FieldControlOptions<TValue, TFlags> = {}) {
    super(opts);
    this._value$ = new BehaviorSubject(value);
    this.initialValue = value;

    if (opts.dirty !== undefined) {
      this.setDirty(opts.dirty);
    }
    if (opts.touched !== undefined) {
      this.setTouched(opts.touched);
    }
    if (opts.disabled !== undefined) {
      this.setDisabled(opts.disabled);
    }
    if (opts.disablers) {
      this.setDisablers(opts.disablers);
    }
    if (opts.triggers) {
      this.setTriggers(opts.triggers);
    }
    if (opts.validators) {
      this.setValidators(opts.validators);
    }

    this.fieldReady();
  }

  setDirty(dirty: boolean) {
    this._dirty$.next(dirty);
    this.update();
  }

  setTouched(touched: boolean) {
    this._touched$.next(touched);
    this.update();
  }

  setDisabled(disabled: boolean) {
    this.setDisablers([() => of(disabled)]);
  }

  setTriggers(triggers: Trigger<FieldControl<TValue, TFlags>>[]) {
    this.triggers = triggers;
    this.trigger();
  }

  setDisablers(disablers: Disabler<FieldControl<TValue, TFlags>>[]) {
    this.disablers = disablers;
    this.updateDisablers();
  }

  setValidators(validators: Validator<FieldControl<TValue, TFlags>>[]) {
    this.validators = validators;
    this.validate();
  }

  setValue = (value: TValue) => {
    this._value$.next(value);
    this._dirty$.next(true);
    this._touched$.next(true);
    this.validate();
    this.trigger();
    this.update();
  };

  patchValue = (value: TValue) => {
    this.setValue(value);
  };

  reset = () => {
    this._value$.next(this.initialValue);
    this._dirty$.next(false);
    this._touched$.next(false);
    this.validate();
    this.trigger();
    this.update();
  };

  validate() {
    this.validatorSub?.unsubscribe();
    this.validatorSub = combineLatest([this._enabled$, this._initialized$])
      .pipe(
        tap(() => this._pending$.next(true)),
        switchMap(() => extractSources<FieldControl<TValue, TFlags>, TFlags, Messages | null>(this, this.validators)),
        map(msgs => msgs.filter(Boolean)),
        map(msgs => (msgs.length ? msgs.reduce((acc, m) => ({ ...acc, ...m }), {}) : null)),
        finalize(() => this._pending$.next(false)),
        catchError(e => {
          this._pending$.next(false);
          throw e;
        }),
        first(),
      )
      .subscribe(errors => {
        this._errors$.next(errors);
        this.update();
      });
  }

  protected trigger() {
    this.triggerSub?.unsubscribe();
    this.triggerSub = this._initialized$
      .pipe(
        switchMap(() => extractSources<FieldControl<TValue, TFlags>, TFlags, void>(this, this.triggers)),
        first(),
      )
      .subscribe();
  }

  protected updateDisablers() {
    this.disablerSub?.unsubscribe();
    this.disablerSub = this._initialized$
      .pipe(
        switchMap(() => extractSources<FieldControl<TValue, TFlags>, TFlags, boolean>(this, this.disablers)),
        map(disableds => disableds.some(Boolean)),
      )
      .subscribe(disabled => {
        this._disabled$.next(disabled);
        this.update();
      });
  }

  get(path: Array<string | number> | string): FieldControl<TValue, TFlags> | null {
    return findControl(this, path, ".");
  }

  update() {
    if (!this.initialized) {
      return;
    }

    const status = this.children.reduce(
      (acc, c) => ({
        dirty: acc.dirty || c.dirty,
        pending: acc.pending || c.pending,
        touched: acc.touched || c.touched,
        valid: acc.valid && c.valid,
      }),
      { dirty: false, pending: false, touched: false, valid: true },
    );
    this._childrenDirty$.next(status.dirty);
    this._childrenPending$.next(status.pending);
    this._childrenTouched$.next(status.touched);
    this._childrenValid$.next(status.valid);
    this._parentDisabled$.next(this._parent?.disabled ?? false);
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
    this.triggerSub?.unsubscribe();
    this.disablerSub?.unsubscribe();
    this.validatorSub?.unsubscribe();

    this._value$.complete();
    this._disabled$.complete();
    this._pending$.complete();
    this._dirty$.complete();
    this._touched$.complete();
    this._errors$.complete();
    this._childrenDirty$.complete();
    this._childrenPending$.complete();
    this._childrenTouched$.complete();
    this._childrenValid$.complete();
    this._parentDisabled$.complete();

    super.dispose();
    this.children.forEach(c => c.dispose());
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

  reset = () => {
    this.children.forEach(control => control.reset());
  };

  update() {
    if (!this.initialized) {
      return;
    }

    const value = reduceControls<TValue, TFlags>(this.controls);
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
    this._dirty$.next(true);
    this._touched$.next(true);
  }

  update() {
    if (!this.initialized) {
      return;
    }

    const value = this.controls.map(control => control.value);
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
