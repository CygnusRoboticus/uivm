import { BehaviorSubject, combineLatest, Subject } from "rxjs";
import { toArray } from "rxjs/operators";
import { ArrayControl, FieldControl, GroupControl } from "./controls";
import { createResolveObservable, createSearchObservable } from "./search";

function tick(delay = 0) {
  return new Promise(resolve => setTimeout(resolve, delay));
}

describe("createSearchObservable", () => {
  let obs: Subject<{ search: string; control: any; params: object; key: string }>;

  beforeEach(() => {
    obs = new Subject<{ search: string; control: any; params: object; key: string }>();
  });

  test("delays correctly", async done => {
    const resolvers = [{ search: (q: string) => [q], resolve: (v: string[]) => v }];
    const searchObs = createSearchObservable(resolvers, obs, 500);
    searchObs.pipe(toArray()).subscribe(v => {
      expect(v).toEqual([["pants3"], ["pants4"]]);
      done();
    });
    obs.next({ search: "pants1", control: {}, params: {}, key: "pants" });
    await tick(200);
    obs.next({ search: "pants2", control: {}, params: {}, key: "pants" });
    await tick(400);
    obs.next({ search: "pants3", control: {}, params: {}, key: "pants" });
    await tick(501);
    obs.next({ search: "pants4", control: {}, params: {}, key: "pants" });
    await tick(501);
    obs.complete();
  });

  test("groups identical search operations", async done => {
    const obs = new Subject<{ search: string; control: any; params: object; key: string }>();
    const resolvers = [{ search: (q: string) => [q], resolve: (v: string[]) => v }];
    const searchObs = createSearchObservable(resolvers, obs);
    searchObs.pipe(toArray()).subscribe(v => {
      expect(v).toEqual([["skirts2"], ["pants4"]]);
      done();
    });
    obs.next({ search: "pants1", control: {}, params: {}, key: "pants" });
    obs.next({ search: "skirts1", control: {}, params: {}, key: "skirts" });
    obs.next({ search: "pants2", control: {}, params: {}, key: "pants" });
    obs.next({ search: "skirts2", control: {}, params: {}, key: "skirts" });
    await tick();
    obs.next({ search: "pants3", control: {}, params: {}, key: "pants" });
    obs.next({ search: "pants4", control: {}, params: {}, key: "pants" });
    await tick(501);
    obs.complete();
  });
});

describe("createResolveObservable", () => {
  let obs: Subject<{ search: string; control: any; params: object; key: string }>;

  beforeEach(() => {
    obs = new Subject<{ search: string; control: any; params: object; key: string }>();
  });

  test("groups identical resolve operations", async done => {
    const obs = new Subject<{ values: string[]; control: any; params: object; key: string }>();
    const resolvers = [{ search: (q: string) => [q], resolve: (v: string[]) => v }];
    const searchObs = createResolveObservable(resolvers, obs);
    searchObs.pipe(toArray()).subscribe(v => {
      expect(v).toEqual([["pants", "skirts", "shorts"], ["skirts"], ["pants"]]);
      done();
    });
    obs.next({ values: ["pants"], control: {}, params: {}, key: "pants" });
    obs.next({ values: ["skirts"], control: {}, params: {}, key: "pants" });
    obs.next({ values: ["skirts"], control: {}, params: {}, key: "skirts" });
    await tick();
    obs.next({ values: ["shorts"], control: {}, params: {}, key: "pants" });
    await tick(501);
    obs.next({ values: ["pants"], control: {}, params: {}, key: "pants" });
    obs.complete();
  });
});
