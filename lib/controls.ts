import { array as AR, readonlyArray as RAR } from "fp-ts";
import { BehaviorSubject, combineLatest, Observable, of, Subscription } from "rxjs";
import { catchError, distinctUntilChanged, filter, finalize, first, map, switchMap, tap } from "rxjs/operators";
import {
  AbstractExtras,
  AbstractHints,
  Disabler,
  Extraer,
  FieldControlOptions,
  FieldControlState,
  Hinter,
  ItemControlOptions,
  ItemControlState,
  Messages,
  Trigger,
  Validator,
} from "./controls.types";
import { extractSources, findControl, reduceControls, traverseParents } from "./controls.utils";
import { Obj } from "./typing";
import { notNullish } from "./utils";

export abstract class BaseControl {
  protected _parent$ = new BehaviorSubject<BaseControl | null>(null);
  protected _root$ = this._parent$.pipe(map(() => traverseParents(this)));

  get parent$() {
    return this._parent$.asObservable();
  }
  get root$() {
    return this._root$;
  }
  get parent() {
    return this._parent$.getValue();
  }
  get root() {
    return traverseParents(this);
  }

  constructor(parent?: BaseControl) {
    this._parent$.next(parent ?? null);
  }

  setParent(parent: BaseControl | null) {
    this._parent$.next(parent);
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

export class ItemControl<
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> extends BaseControl {
  protected _hints$ = new BehaviorSubject<Partial<THints>>({});
  protected _extras$ = new BehaviorSubject<Partial<TExtras>>({});
  protected _messages$ = new BehaviorSubject<Messages | null>(null);

  protected hinters: Hinter<ItemControl<THints, TExtras>, THints>[] = [];
  protected messagers: Validator<ItemControl<THints, TExtras>>[] = [];
  protected extraers: Extraer<ItemControl<THints, TExtras>, TExtras> | null = null;

  protected hintsSub?: Subscription;
  protected messagesSub?: Subscription;
  protected extrasSub?: Subscription;

  get hints() {
    return this._hints$.getValue();
  }
  get extras() {
    return this._extras$.getValue();
  }
  get messages() {
    return this._messages$.getValue();
  }
  get state(): ItemControlState<THints, TExtras> {
    return {
      messages: this.messages,
      hints: this.hints,
      extras: this.extras,
    };
  }

  get hints$() {
    return this._hints$.asObservable();
  }
  get extras$() {
    return this._extras$.asObservable();
  }
  get messages$() {
    return this.__messages$;
  }
  get state$() {
    return this._state$;
  }

  protected __messages$ = this._messages$.pipe(distinctUntilChanged());
  protected _state$: Observable<ItemControlState<THints, TExtras>> = combineLatest([
    this.hints$,
    this.extras$,
    this.messages$,
  ]).pipe(map(([hints, extras, messages]) => ({ hints, extras, messages })));

  protected _initializer$ = new BehaviorSubject(false);
  protected _initialized$ = this._initializer$.pipe(filter(Boolean));
  protected get initialized() {
    return this._initializer$.getValue();
  }

  updateHints() {
    this.hintsSub?.unsubscribe();
    this.hintsSub = this._initialized$
      .pipe(
        switchMap(() =>
          extractSources<ItemControl<THints, TExtras>, THints, TExtras, [keyof THints, boolean]>(this, this.hinters),
        ),
        map(flgs =>
          flgs.reduce((acc, [k, v]) => {
            acc[k] = (!!acc[k] || v) as THints[typeof k];
            return acc;
          }, {} as THints),
        ),
      )
      .subscribe(hints => this._hints$.next(hints));
  }

  updateExtras() {
    this.extrasSub?.unsubscribe();
    this.extrasSub = this._initialized$
      .pipe(switchMap(() => (this.extraers ? this.extraers(this) : of({}))))
      .subscribe(extras => this._extras$.next(extras));
  }

  updateMessages() {
    this.messagesSub?.unsubscribe();
    this.messagesSub = this._initialized$
      .pipe(
        switchMap(() =>
          extractSources<ItemControl<THints, TExtras>, THints, TExtras, Messages | null>(this, this.messagers),
        ),
        map(AR.filter(notNullish)),
        map(msgs => (msgs.length ? msgs.reduce((acc, m) => ({ ...acc, ...m }), {}) : null)),
        distinctUntilChanged(),
      )
      .subscribe(messages => this._messages$.next(messages));
  }

  constructor(opts: ItemControlOptions<THints, TExtras> = {}, parent?: ItemControl<THints, TExtras>) {
    super(parent);
    if (opts.hinters) {
      this.setHinters(opts.hinters);
    }
    if (opts.extraers) {
      this.setExtraers(opts.extraers);
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

  setHinters(hinters: Hinter<ItemControl<THints, TExtras>, THints>[]) {
    this.hinters = hinters;
    this.updateHints();
  }

  setExtraers(extraers: Extraer<ItemControl<THints, TExtras>, TExtras> | null) {
    this.extraers = extraers;
    this.updateExtras();
  }

  setMessagers(messagers: Validator<ItemControl<THints, TExtras>>[]) {
    this.messagers = messagers;
    this.updateMessages();
  }

  dispose() {
    this.hintsSub?.unsubscribe();
    this.extrasSub?.unsubscribe();
    this.messagesSub?.unsubscribe();

    this._hints$.complete();
    this._extras$.complete();
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

export class FieldControl<
  TValue,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> extends ItemControl<THints, TExtras> {
  protected initialValue: TValue;
  protected _parent: FieldControl<unknown, THints, TExtras> | null = null;

  // Internal values
  protected _value$: BehaviorSubject<TValue>;
  protected _disabled$ = new BehaviorSubject(false);
  protected _pending$ = new BehaviorSubject(false);
  protected _dirty$ = new BehaviorSubject(false);
  protected _touched$ = new BehaviorSubject(false);
  protected _errors$ = new BehaviorSubject<Messages | null>(null);

  protected _childrenValid$ = new BehaviorSubject(true);
  protected _childrenDirty$ = new BehaviorSubject(false);
  protected _childrenPending$ = new BehaviorSubject(false);
  protected _childrenTouched$ = new BehaviorSubject(false);
  protected _parentDisabled$ = new BehaviorSubject(false);

  protected triggers: Trigger<FieldControl<TValue, THints, TExtras>>[] = [];
  protected disablers: Disabler<FieldControl<TValue, THints, TExtras>>[] = [];
  protected validators: Validator<FieldControl<TValue, THints, TExtras>>[] = [];

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
  get state(): FieldControlState<TValue, THints, TExtras> {
    return {
      value: this.value,
      errors: this.errors,
      disabled: this.disabled,
      valid: this.valid,
      pending: this.pending,
      dirty: this.dirty,
      touched: this.touched,

      messages: this.messages,
      hints: this.hints,
      extras: this.extras,
    };
  }

  get value$() {
    return this.__value$;
  }
  get disabled$() {
    return this.__disabled$;
  }
  get valid$() {
    return this.__valid$;
  }
  get pending$() {
    return this.__pending$;
  }
  get dirty$() {
    return this.__dirty$;
  }
  get touched$() {
    return this.__touched$;
  }
  get errors$() {
    return this.__errors$;
  }
  get state$() {
    return this._state$;
  }

  // Piped behavior subjects
  protected __value$: Observable<TValue>;
  protected __disabled$ = combineLatest([this._disabled$, this._parentDisabled$]).pipe(
    map(([d, pd]) => d || pd),
    distinctUntilChanged(),
  );
  protected __valid$ = combineLatest([this._errors$, this._childrenValid$]).pipe(
    map(([e, cv]) => !e && cv),
    distinctUntilChanged(),
  );
  protected __pending$ = combineLatest([this._pending$, this._childrenPending$]).pipe(
    map(([p, cp]) => p || cp),
    distinctUntilChanged(),
  );
  protected __dirty$ = combineLatest([this._dirty$, this._childrenDirty$]).pipe(
    map(([d, cd]) => d || cd),
    distinctUntilChanged(),
  );
  protected __touched$ = combineLatest([this._touched$, this._childrenTouched$]).pipe(
    map(([t, ct]) => t || ct),
    distinctUntilChanged(),
  );
  protected __errors$ = this._errors$.pipe(distinctUntilChanged());
  protected _enabled$ = this.__disabled$.pipe(
    map(v => !v),
    filter(Boolean),
  );
  protected _state$: Observable<FieldControlState<TValue, THints, TExtras>>;

  constructor(value: TValue, opts: FieldControlOptions<TValue, THints, TExtras> = {}) {
    super(opts);
    this._value$ = new BehaviorSubject(value);
    this.__value$ = this._value$.pipe(distinctUntilChanged());
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

    this._state$ = combineLatest([
      this.value$,
      this.errors$,
      this.messages$,
      this.hints$,
      this.extras$,
      combineLatest([this.disabled$, this.valid$, this.pending$, this.dirty$, this.touched$]),
    ]).pipe(
      map(([value, errors, messages, hints, extras, [disabled, valid, pending, dirty, touched]]) => ({
        value,
        errors,
        messages,
        hints,
        extras,
        disabled,
        valid,
        pending,
        dirty,
        touched,
      })),
    );

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

  setTriggers(triggers: Trigger<FieldControl<TValue, THints, TExtras>>[]) {
    this.triggers = triggers;
    this.trigger();
  }

  setDisablers(disablers: Disabler<FieldControl<TValue, THints, TExtras>>[]) {
    this.disablers = disablers;
    this.updateDisablers();
  }

  setValidators(validators: Validator<FieldControl<TValue, THints, TExtras>>[]) {
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

  reset = (value?: TValue) => {
    if (value !== undefined) {
      this.initialValue = value;
    }

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
        switchMap(() =>
          extractSources<FieldControl<TValue, THints, TExtras>, THints, TExtras, Messages | null>(
            this,
            this.validators,
          ),
        ),
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
        switchMap(() =>
          extractSources<FieldControl<TValue, THints, TExtras>, THints, TExtras, void>(this, this.triggers),
        ),
        first(),
      )
      .subscribe();
  }

  protected updateDisablers() {
    this.disablerSub?.unsubscribe();
    this.disablerSub = this._initialized$
      .pipe(
        switchMap(() =>
          extractSources<FieldControl<TValue, THints, TExtras>, THints, TExtras, boolean>(this, this.disablers),
        ),
        map(disableds => disableds.some(Boolean)),
      )
      .subscribe(disabled => {
        this._disabled$.next(disabled);
        this.update();
      });
  }

  get<TValue = unknown>(path: Array<string | number> | string): FieldControl<TValue, THints, TExtras> | null {
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

  get children() {
    return <FieldControl<unknown, THints, TExtras>[]>[];
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

export type ArrayType<T> = T extends Array<infer R> ? R : never;

export type KeyValueControls<TValue extends Obj, THints extends AbstractHints, TExtras extends AbstractExtras> = {
  [k in keyof TValue]: FieldControl<TValue[k], THints, TExtras>;
};

export type KeyControlsValue<TControls extends Obj> = {
  [k in keyof TControls]: TControls[k]["value"];
};

export class GroupControl<
  TValue extends KeyControlsValue<TControls>,
  TControls extends KeyValueControls<TValue, THints, TExtras>,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> extends FieldControl<TValue, THints, TExtras> {
  constructor(public controls: TControls, opts: FieldControlOptions<TValue, THints, TExtras> = {}) {
    super(reduceControls<TValue, THints, TExtras>(controls), opts);
    this.controls = controls;
    this.children.forEach(control => this.registerControl(control as TControls[keyof TControls]));

    this.groupReady();
  }

  get children() {
    return Object.values(this.controls) as FieldControl<unknown, THints, TExtras>[];
  }

  setValue = (value: TValue) => {
    Object.keys(value).forEach(name => {
      const control = this.get(name);
      if (control) {
        control.setValue(value[name as keyof TValue]);
      }
    });
  };

  patchValue = (value: Partial<TValue>) => {
    Object.keys(value).forEach(name => {
      const control = this.get(name);
      if (control) {
        control.patchValue(value[name as keyof TValue]);
      }
    });
  };

  reset = (value?: Partial<TValue>) => {
    Object.keys(this.controls).forEach(name => {
      const control = this.get(name);
      if (control) {
        const v = value?.[name as keyof TValue] ?? null;
        control.reset(v);
      }
    });
  };

  update() {
    if (!this.initialized) {
      return;
    }

    const value = reduceControls<TValue, THints, TExtras>(this.controls);
    this._value$.next(value);
    super.update();
  }

  protected registerControl(control: ItemControl<THints, TExtras>) {
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
  TControls extends KeyValueControls<TValue, THints, TExtras>,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> extends FieldControl<TValue[], THints, TExtras> {
  controls: ReturnType<this["itemFactory"]>[];

  get itemFactory() {
    return this._itemFactory;
  }

  constructor(
    protected _itemFactory: (value: TValue | null) => GroupControl<TValue, TControls, THints, TExtras>,
    value: TValue[] = [],
    opts: FieldControlOptions<TValue[], THints, TExtras> = {},
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
    return this.controls as FieldControl<unknown, THints, TExtras>[];
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

  protected registerControl(control: ItemControl<THints, TExtras>) {
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
