import { combineLatest } from "rxjs";
import { first } from "rxjs/operators";
import { ArrayControl, FieldControl, GroupControl } from "./controls";

describe("controls", () => {
  const createForm = () =>
    new GroupControl({
      field1: new FieldControl("pants"),
      field2: new FieldControl("skirts"),
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

  test("status bubbles upwards", async () => {
    let index = 0;
    form.status$.subscribe(v => {
      if (index === 0) {
        expect(v).toEqual({ dirty: false, disabled: false, pending: false, touched: false, valid: true });
      } else if (index === 4) {
        expect(v).toEqual({ dirty: true, disabled: false, pending: false, touched: true, valid: true });
      } else {
        expect(v).toEqual({ asdf: 1 });
      }
      index++;
    });
    field1.status$.subscribe(v => {
      if (index === 1) {
        expect(v).toEqual({ dirty: false, disabled: false, pending: false, touched: false, valid: true });
      } else if (index === 3) {
        expect(v).toEqual({ dirty: true, disabled: false, pending: false, touched: true, valid: true });
      } else {
        expect(v).toEqual({ asdf: 2 });
      }
      index++;
    });
    form.controls.array1.controls[0].status$.subscribe(v => {
      if (index === 2) {
        expect(v).toEqual({ dirty: false, disabled: false, pending: false, touched: false, valid: true });
      } else {
        expect(v).toEqual({ asdf: 3 });
      }
      index++;
    });
    field1.setValue("pants3");
    expect.assertions(5);
  });

  test("flags are set from executors", async () => {
    expect(await field1.flags$.pipe(first()).toPromise()).toEqual({ hidden: false });
    field1.setFlaggers([() => ["hidden", true]]);
    expect(await field1.flags$.pipe(first()).toPromise()).toEqual({ hidden: true });
    expect(await form.flags$.pipe(first()).toPromise()).toEqual({ hidden: false });
  });

  test("messages are set from executors", async () => {
    let index = 0;
    field1.messages$.subscribe(v => {
      if (index === 0) {
        expect(v).toEqual(null);
      } else if (index === 1) {
        expect(v).toEqual({ pants: { message: "skirts" } });
      } else if (index === 2) {
        expect(v).toEqual(null);
      } else {
        expect(v).toEqual([]);
      }
      index++;
    });
    field1.setMessagers([() => ({ pants: { message: "skirts" } })]);
    field1.setMessagers([]);
    expect.assertions(3);
  });

  test("triggers are fired on update", async () => {
    field1.setTriggers([() => expect(true).toBeTruthy()]);
    field1.setValue("pants");
    expect.assertions(1);
  });

  test("errors are set from validators", () => {
    let index = 0;
    combineLatest([field1.errors$, field1.status$]).subscribe(v => {
      if (index === 0) {
        expect(v).toEqual([null, { dirty: false, disabled: false, pending: false, touched: false, valid: true }]);
      } else if (index === 1) {
        expect(v).toEqual([
          { pants: { message: "skirts" } },
          { dirty: false, disabled: false, pending: false, touched: false, valid: true },
        ]);
      } else if (index === 2) {
        expect(v).toEqual([
          { pants: { message: "skirts" } },
          { dirty: false, disabled: false, pending: false, touched: false, valid: false },
        ]);
      } else if (index === 3) {
        expect(v).toEqual([null, { dirty: false, disabled: false, pending: false, touched: false, valid: false }]);
      } else if (index === 4) {
        expect(v).toEqual([null, { dirty: false, disabled: false, pending: false, touched: false, valid: true }]);
      } else if (index === 5) {
        expect(v).toEqual([null, { dirty: true, disabled: false, pending: false, touched: true, valid: true }]);
      } else {
        expect(v).toEqual([]);
      }
      index++;
    });
    field1.setValidators([c => (c.value === "pants" ? { pants: { message: "skirts" } } : null)]);
    field1.setValue("skirts");
    expect.assertions(6);
  });

  test("validators do not run if not subscribed", () => {
    field1.setValidators([
      c => {
        expect(true).toEqual(false);
        return c.value === "pants" ? { pants: { message: "skirts" } } : null;
      },
    ]);
    field1.setValue("skirts");
  });
});
