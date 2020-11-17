import { BehaviorSubject, combineLatest } from "rxjs";
import { toArray } from "rxjs/operators";
import { ArrayControl, FieldControl, GroupControl } from "./controls";

function tick() {
  return new Promise(resolve => setTimeout(resolve));
}

describe("controls", () => {
  const createForm = () =>
    new GroupControl({
      field1: new FieldControl("pants"),
      field2: new FieldControl("skirts"),
      // @ts-ignore
      group1: new GroupControl({
        field3: new FieldControl("shorts"),
      }),
      array1: new ArrayControl(
        (v: { groupField1: string | null } | null) =>
          new GroupControl({
            groupField1: new FieldControl(v?.groupField1 ?? null),
          }),
        [{ groupField1: "shirts" }],
      ),
    });

  let form: ReturnType<typeof createForm>;
  let field1: ReturnType<typeof createForm>["controls"]["field1"];

  beforeEach(() => {
    form = createForm();
    field1 = form.controls.field1;
  });

  afterEach(() => {
    form.dispose();
  });

  test("compiles", () => {
    const {
      field1: _,
      field2: __,
      // @ts-ignore
      group1: { field3: ___ },
      array1: [{ groupField1: ____ }],
    } = form.value;
    expect(true).toBeTruthy();
  });

  test("value is updated", () => {
    expect(form.value).toEqual({
      array1: [{ groupField1: "shirts" }],
      field1: "pants",
      field2: "skirts",
      group1: {
        field3: "shorts",
      },
    });
    form.patchValue({
      array1: [{ groupField1: "shirts" }, { groupField1: "shorts" }],
      field1: "pants1",
      field2: "skirts2",
    });

    expect(form.value).toEqual({
      array1: [{ groupField1: "shirts" }, { groupField1: "shorts" }],
      field1: "pants1",
      field2: "skirts2",
      group1: {
        field3: "shorts",
      },
    });
  });

  test("status bubbles upwards", async done => {
    combineLatest([
      form.dirty$,
      field1.dirty$,
      form.controls.array1.controls[0].dirty$,
      form.touched$,
      field1.touched$,
      form.controls.array1.controls[0].touched$,
    ])
      .pipe(toArray())
      .subscribe(v => {
        expect(v).toEqual([
          [false, false, false, false, false, false],
          [false, true, false, false, false, false],
          [false, true, false, false, true, false],
          [true, true, false, false, true, false],
          [true, true, false, true, true, false],
        ]);
        done();
      });
    expect(field1.dirty).toEqual(false);
    expect(field1.touched).toEqual(false);
    field1.setValue("pants3");
    expect(field1.dirty).toEqual(true);
    expect(field1.touched).toEqual(true);
    await tick();
    form.dispose();
  });

  test("hints are set from executors", async done => {
    combineLatest([field1.hints$, form.hints$])
      .pipe(toArray())
      .subscribe(v => {
        expect(v).toEqual([
          [{}, {}],
          [{ hidden: true }, {}],
          [{ hidden: false }, {}],
        ]);
        done();
      });
    const obs = new BehaviorSubject<[string, boolean]>(["hidden", true]);
    expect(field1.hints).toEqual({});
    await tick();
    field1.setHinters([() => obs]);
    await tick();
    expect(field1.hints).toEqual({ hidden: true });
    obs.next(["hidden", false]);
    await tick();
    form.dispose();
  });

  test("messages are set from executors", async done => {
    field1.messages$.pipe(toArray()).subscribe(v => {
      expect(v).toEqual([null, { pants: { message: "skirts" } }, null]);
      done();
    });
    field1.setMessagers([() => ({ pants: { message: "skirts" } })]);
    field1.setMessagers([]);
    await tick();
    form.dispose();
  });

  test("triggers are fired on update", () => {
    field1.setTriggers([() => expect(true).toBeTruthy()]);
    field1.setValue("pants");
    expect.assertions(2);
  });

  test("errors are set from validators", async done => {
    combineLatest([field1.errors$, field1.valid$])
      .pipe(toArray())
      .subscribe(v => {
        expect(v).toEqual([
          [null, true],
          [{ pants: { message: "skirts" } }, true],
          [{ pants: { message: "skirts" } }, false],
          [null, false],
          [null, true],
        ]);
        done();
      });
    field1.setValidators([c => (c.value === "pants" ? { pants: { message: "skirts" } } : null)]);
    await tick();
    field1.setValue("skirts");
    await tick();
    form.dispose();
  });
});
