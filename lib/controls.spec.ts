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
    expect((await form.status$.pipe(first()).toPromise()).dirty).toBeFalsy();
    field1.setValue("pants3");
    expect((await field1.status$.pipe(first()).toPromise()).dirty).toBeTruthy();
    expect((await form.status$.pipe(first()).toPromise()).dirty).toBeTruthy();
    expect((await form.controls.array1.controls[0].status$.pipe(first()).toPromise()).dirty).toBeFalsy();
  });

  test("flags are set from executors", async () => {
    expect(await field1.flags$.pipe(first()).toPromise()).toEqual({ hidden: false });
    field1.setFlaggers([() => ["hidden", true]]);
    expect(await field1.flags$.pipe(first()).toPromise()).toEqual({ hidden: true });
    expect(await form.flags$.pipe(first()).toPromise()).toEqual({ hidden: false });
  });

  test("messages are set from executors", async () => {
    expect(await field1.messages$.pipe(first()).toPromise()).toEqual(null);
    field1.setMessagers([() => ({ pants: { message: "skirts" } })]);
    expect(await field1.messages$.pipe(first()).toPromise()).toEqual({ pants: { message: "skirts" } });
    expect(await form.messages$.pipe(first()).toPromise()).toEqual(null);
  });

  test("triggers are fired on update", async () => {
    field1.setTriggers([() => expect(true).toBeTruthy()]);
    field1.setValue("pants");
    expect.assertions(1);
  });

  test("errors are set from validators", async () => {
    expect(await field1.errors$.pipe(first()).toPromise()).toEqual(null);
    expect((await field1.status$.pipe(first()).toPromise()).valid).toEqual(true);
    field1.setValidators([c => (c.value === "pants" ? { pants: { message: "skirts" } } : null)]);
    console.log(1);
    expect(await field1.errors$.pipe(first()).toPromise()).toEqual({ pants: { message: "skirts" } });
    expect((await field1.status$.pipe(first()).toPromise()).valid).toEqual(false);
    console.log(1);
    field1.setValue("skirts");
    expect(await field1.errors$.pipe(first()).toPromise()).toEqual(null);
    expect((await field1.status$.pipe(first()).toPromise()).valid).toEqual(true);
    console.log(1);
  });
});
