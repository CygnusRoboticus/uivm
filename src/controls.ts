import { array as AR, readonlyArray as RAR } from "fp-ts";
import { pipe } from "fp-ts/lib/function";
import { BehaviorSubject, combineLatest, Observable, of, Subject, Subscription } from "rxjs";
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
  KeyControlsValue,
  KeyValueControls,
  Messages,
  Trigger,
  Validator,
} from "./controls.types";
import { extractSources, findControl, reduceControls, traverseParents } from "./controls.utils";
import { DeepPartial } from "./typing.utils";
import { notNullish } from "./utils";

export abstract class BaseControl {
  protected _parent$ = new BehaviorSubject<BaseControl | null>(null);
  protected _children$ = new BehaviorSubject<BaseControl[]>([]);
  protected _parentChange$ = new BehaviorSubject(null);
  protected _parents$ = combineLatest([this._parent$, this._parentChange$]).pipe(map(() => this.parents));
  protected _root$ = this._parents$.pipe(map(() => this.root));
  protected _dispose$ = new Subject();

  get parent$() {
    return this._parent$.asObservable();
  }
  get parents$() {
    return this._parents$;
  }
  get root$() {
    return this._root$;
  }
  get children$() {
    return this._children$.asObservable();
  }
  get dispose$() {
    return this._dispose$.asObservable();
  }

  get parent() {
    return this._parent$.value;
  }
  get parents() {
    return traverseParents(this);
  }
  get root() {
    return pipe(traverseParents(this), a => a[a.length - 1] ?? this);
  }
  get children() {
    return this._children$.value;
  }

  constructor(parent?: BaseControl) {
    this._parent$.next(parent ?? null);
  }

  setParent(parent: BaseControl | null) {
    if (parent === this) {
      return;
    }

    this._parent$.next(parent);
    const curr = parent?.children ?? [];
    if (!curr.includes(this)) {
      parent?._children$.next([...curr, this]);
    }
    this.children.forEach(c => c._parentChange$.next(null));
  }

  addChild(child: BaseControl) {
    child.setParent(this);
  }

  removeChild(child: BaseControl) {
    child?.setParent(null);
  }

  abstract update(): void;

  dispose() {
    this._parent$.complete();
    this._children$.complete();

    this.children.forEach(c => c.dispose());
    this._dispose$.next();
    this._dispose$.complete();
  }

  toJSON() {
    return {
      parent: this.parent,
      name: "BaseControl",
    };
  }
}

export class ItemControl<THints extends AbstractHints = AbstractHints, TExtras = AbstractExtras> extends BaseControl {
  protected _hints$ = new BehaviorSubject<Partial<THints>>({});
  protected _extras$ = new BehaviorSubject<Partial<TExtras>>({});
  protected _messages$ = new BehaviorSubject<Messages | null>(null);

  protected hinters: Hinter<ItemControl<THints, TExtras>, THints>[] = [];
  protected messagers: Validator<ItemControl<THints, TExtras>>[] = [];
  protected extraers: Extraer<ItemControl<THints, TExtras>, TExtras>[] = [];

  protected hintsSub?: Subscription;
  protected messagesSub?: Subscription;
  protected extrasSub?: Subscription;

  get hints() {
    return this._hints$.value;
  }
  get extras() {
    return this._extras$.value;
  }
  get messages() {
    return this._messages$.value;
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
    return this._initializer$.value;
  }

  updateHints() {
    this.hintsSub?.unsubscribe();
    this.hintsSub = this._initialized$
      .pipe(
        switchMap(() => extractSources<ItemControl<THints, TExtras>, [keyof THints, boolean]>(this, this.hinters)),
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
      .pipe(
        switchMap(() => extractSources<ItemControl<THints, TExtras>, Partial<TExtras>>(this, this.extraers)),
        map(flgs => flgs.reduce((acc, extras) => Object.assign(acc, extras), {} as TExtras)),
      )
      .subscribe(extras => this._extras$.next(extras));
  }

  updateMessages() {
    this.messagesSub?.unsubscribe();
    this.messagesSub = this._initialized$
      .pipe(
        switchMap(() => extractSources<ItemControl<THints, TExtras>, Messages | null>(this, this.messagers)),
        map(AR.filter(notNullish)),
        map(msgs => (msgs.length ? msgs.reduce((acc, m) => ({ ...acc, ...m }), {}) : null)),
        distinctUntilChanged(),
      )
      .subscribe(messages => this._messages$.next(messages));
  }

  constructor(opts: ItemControlOptions<THints, TExtras> = {}, parent?: ItemControl<THints, TExtras>) {
    super(parent);
    if (opts.hints) {
      this.setHinters(opts.hints);
    }
    if (opts.extras) {
      this.setExtraers(opts.extras);
    }
    if (opts.messages) {
      this.setMessagers(opts.messages);
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

  addHinters(...hinters: Hinter<ItemControl<THints, TExtras>, THints>[]) {
    if (hinters.length) {
      this.setHinters([...this.hinters, ...hinters]);
    }
  }

  setExtraers(extraers: Extraer<ItemControl<THints, TExtras>, TExtras>[]) {
    this.extraers = extraers;
    this.updateExtras();
  }

  addExtraers(...extraers: Extraer<ItemControl<THints, TExtras>, TExtras>[]) {
    if (extraers.length) {
      this.setExtraers([...this.extraers, ...extraers]);
    }
  }

  setMessagers(messagers: Validator<ItemControl<THints, TExtras>>[]) {
    this.messagers = messagers;
    this.updateMessages();
  }

  addMessagers(...messagers: Validator<ItemControl<THints, TExtras>>[]) {
    if (messagers.length) {
      this.setMessagers([...this.messagers, ...messagers]);
    }
  }

  clone() {
    return new ItemControl({ hints: this.hinters, extras: this.extraers ?? undefined, messages: this.messagers });
  }

  dispose() {
    this.hintsSub?.unsubscribe();
    this.extrasSub?.unsubscribe();
    this.messagesSub?.unsubscribe();

    this._hints$.complete();
    this._extras$.complete();
    this._messages$.complete();
    this._initializer$.complete();

    super.dispose();
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
  TExtras = AbstractExtras
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

  protected _parentDisabled$ = new BehaviorSubject(false);

  protected triggers: Trigger<FieldControl<TValue, THints, TExtras>>[] = [];
  protected disablers: Disabler<FieldControl<TValue, THints, TExtras>>[] = [];
  protected validators: Validator<FieldControl<TValue, THints, TExtras>>[] = [];

  protected triggerSub?: Subscription;
  protected disablerSub?: Subscription;
  protected validatorSub?: Subscription;

  get value() {
    return this._value$.value;
  }
  get disabled() {
    return this._disabled$.value || this._parentDisabled$.value;
  }
  get valid() {
    return !this._errors$.value;
  }
  get pending() {
    return this._pending$.value;
  }
  get dirty() {
    return this._dirty$.value;
  }
  get touched() {
    return this._touched$.value;
  }
  get errors() {
    return this._errors$.value;
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
  protected __valid$ = this._errors$.pipe(
    map(e => !e),
    distinctUntilChanged(),
  );
  protected __pending$ = this._pending$.pipe(distinctUntilChanged());
  protected __dirty$ = this._dirty$.pipe(distinctUntilChanged());
  protected __touched$ = this._touched$.pipe(distinctUntilChanged());
  protected __errors$ = this._errors$.pipe(distinctUntilChanged());
  protected _enabled$ = this.__disabled$.pipe(
    map(v => !v),
    distinctUntilChanged(),
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
      map(([v, errors, messages, hints, extras, [disabled, valid, pending, dirty, touched]]) => ({
        value: v,
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

  addTriggers(...triggers: Trigger<FieldControl<TValue, THints, TExtras>>[]) {
    if (triggers.length) {
      this.setTriggers([...this.triggers, ...triggers]);
    }
  }

  setDisablers(disablers: Disabler<FieldControl<TValue, THints, TExtras>>[]) {
    this.disablers = disablers;
    this.updateDisablers();
  }

  addDisablers(...disablers: Disabler<FieldControl<TValue, THints, TExtras>>[]) {
    if (disablers.length) {
      this.setDisablers([...this.disablers, ...disablers]);
    }
  }

  setValidators(validators: Validator<FieldControl<TValue, THints, TExtras>>[]) {
    this.validators = validators;
    this.validate();
  }

  addValidators(...validators: Validator<FieldControl<TValue, THints, TExtras>>[]) {
    if (validators.length) {
      this.setValidators([...this.validators, ...validators]);
    }
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
        switchMap(() => extractSources<FieldControl<TValue, THints, TExtras>, Messages | null>(this, this.validators)),
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
        switchMap(() => extractSources<FieldControl<TValue, THints, TExtras>, void>(this, this.triggers)),
        first(),
      )
      .subscribe();
  }

  protected updateDisablers() {
    this.disablerSub?.unsubscribe();
    this.disablerSub = this._initialized$
      .pipe(
        switchMap(() => extractSources<FieldControl<TValue, THints, TExtras>, boolean>(this, this.disablers)),
        map(disableds => disableds.some(Boolean)),
      )
      .subscribe(disabled => {
        this._disabled$.next(disabled);
        this.update();
      });
  }

  get<TControlValue = unknown>(
    path: Array<string | number> | string,
  ): FieldControl<TControlValue, THints, TExtras> | null {
    return findControl(this, path, ".");
  }

  update() {
    if (!this.initialized) {
      return;
    }

    this._parentDisabled$.next(this._parent?.disabled ?? false);
    super.update();
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
    this._parentDisabled$.complete();

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

export class GroupControl<
  TValue extends KeyControlsValue<TControls>,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras,
  TControls extends KeyValueControls<TValue, THints, TExtras> = KeyValueControls<TValue, THints, TExtras>
> extends FieldControl<TValue, THints, TExtras> {
  protected _validChildren$ = new BehaviorSubject(true);
  protected _childrenDirty$ = new BehaviorSubject(false);
  protected _childrenPending$ = new BehaviorSubject(false);
  protected _childrenTouched$ = new BehaviorSubject(false);

  get valid() {
    return !this._errors$.value && this._validChildren$.value;
  }
  get pending() {
    return this._pending$.value || this._childrenPending$.value;
  }
  get dirty() {
    return this._dirty$.value || this._childrenDirty$.value;
  }
  get touched() {
    return this._touched$.value || this._childrenTouched$.value;
  }

  protected get controlList() {
    return Object.values(this.controls) as TControls[keyof TControls][];
  }

  // Piped behavior subjects
  protected __valid$ = combineLatest([this._errors$, this._validChildren$]).pipe(
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

  constructor(public controls: TControls, opts: FieldControlOptions<TValue, THints, TExtras> = {}) {
    super(reduceControls<TValue, THints, TExtras>(controls), opts);
    this.controls = controls;
    this.controlList.forEach(c => this.registerControl(c));

    this.groupReady();
  }

  /**
   * Add control to controls listing, replacing any existing controls. Use with
   * caution, as the types will no longer reflect the value/controls of this group.
   * `isChild` determines if the control should be added as a child in as well, for cases
   * where the control is a logical value rather than a structural value.
   */
  addControl(name: string, control: FieldControl<any, THints, TExtras>, isChild = true) {
    (this.controls as any)[name] = control;
    if (isChild) {
      this.registerControl(control);
    }
    this.update();
  }

  setValue = (value: TValue) => {
    Object.keys(value).forEach(name => {
      const control = this.get(name);
      if (control) {
        control.setValue(value[name as keyof TValue]);
      }
    });
  };

  patchValue = (value: DeepPartial<TValue>) => {
    Object.keys(value).forEach(name => {
      const control = this.get(name);
      if (control) {
        control.patchValue(value[name as keyof TValue]);
      }
    });
  };

  reset = (value?: TValue) => {
    if (value !== undefined) {
      this.initialValue = value;
    }

    Object.keys(this.controls).forEach(name => {
      const control = this.get(name);
      if (control) {
        const v = value?.[name as keyof TValue];
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

    const status = this.controlList.reduce(
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
    this._validChildren$.next(status.valid);

    super.update();
  }

  dispose() {
    this._childrenDirty$.complete();
    this._childrenPending$.complete();
    this._childrenTouched$.complete();
    this._validChildren$.complete();
    this.controlList.forEach(c => c.dispose());

    super.dispose();
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
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras,
  TControls extends KeyValueControls<TValue, THints, TExtras> = KeyValueControls<TValue, THints, TExtras>
> extends FieldControl<TValue[], THints, TExtras> {
  controls: ReturnType<this["itemFactory"]>[];

  protected _itemFactory: (value: TValue | null) => GroupControl<TValue, THints, TExtras, TControls>;
  get itemFactory() {
    return this._itemFactory;
  }

  constructor(
    itemFactory: (value: TValue | null) => GroupControl<TValue, THints, TExtras, TControls>,
    value: TValue[] = [],
    opts: FieldControlOptions<TValue[], THints, TExtras> = {},
  ) {
    super(value, opts);
    this._itemFactory = itemFactory;
    this.controls = value.map(v => this.itemFactory(v) as ReturnType<this["itemFactory"]>);
    this.controls.forEach(control => this.registerControl(control));

    this.arrayReady();
  }

  get length() {
    return this.controls.length;
  }

  get children() {
    return this.controls as FieldControl<unknown, THints, TExtras>[];
  }

  at(index: number) {
    const c = this.controls[index];
    return c as typeof c | undefined;
  }

  push = (...items: ReturnType<this["itemFactory"]>[]) => {
    this.insertAt(this.controls.length, ...items);
  };

  pop = () => {
    this.removeAt(this.controls.length - 1);
  };

  unshift = (...items: ReturnType<this["itemFactory"]>[]) => {
    this.insertAt(0, ...items);
  };

  pushValue = (...value: TValue[]) => {
    const controls = (value.length ? value.map(v => this.itemFactory(v)) : [this.itemFactory(null)]) as ReturnType<
      this["itemFactory"]
    >[];
    this.push(...controls);
  };

  unshiftValue = (...value: TValue[]) => {
    const controls = (value.length ? value.map(v => this.itemFactory(v)) : [this.itemFactory(null)]) as ReturnType<
      this["itemFactory"]
    >[];
    this.unshift(...controls);
  };

  insertAt = (index: number, ...items: ReturnType<this["itemFactory"]>[]) => {
    if (index >= 0 || index <= this.controls.length) {
      this.controls.splice(index, 0, ...items);
      items.forEach(item => this.registerControl(item));
      this.update();
    }
  };

  removeAt = (index: number) => {
    if (index >= 0 && index < this.controls.length) {
      const control = this.controls.splice(index, 1);
      control.forEach(c => c.dispose());
      this.update();
    }
  };

  setValue = (value: TValue[]) => {
    this.resize(value.length);
    value.forEach((newValue, index) => {
      const control = this.at(index);
      if (control && control instanceof FieldControl) {
        control.setValue(newValue);
      }
    });
  };

  patchValue = (value: DeepPartial<TValue>[]) => {
    this.resize(value.length);
    value.forEach((v, index) => {
      const control = this.at(index);
      control?.patchValue(v);
    });
  };

  patchEachValue = (value: DeepPartial<TValue>) => {
    this.controls.forEach(control => control.patchValue(value));
  };

  reset = (value?: TValue[]) => {
    if (value !== undefined) {
      this.initialValue = value;
    }

    this.resize(this.initialValue.length);
    this.controls.forEach((control, i) => control.reset(this.initialValue[i]));
  };

  getRawValue(): TValue[] {
    return this.controls.map(control => {
      return control instanceof FieldControl ? control.value : (<any>control).getRawValue();
    });
  }

  clear() {
    this.controls.forEach(c => c.dispose());
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
