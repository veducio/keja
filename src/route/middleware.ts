const middlewareBrand = "keja.middleware";
const middlewareFields: unique symbol = Symbol("keja.middleware.fields");
declare const passed: unique symbol;

const reservedFields = ["params", "query", "body", "respond"] as const;

type ReservedField = (typeof reservedFields)[number];

type ForbidReserved<Fields> = Fields & {
  [Key in ReservedField]?: never;
};

export type MiddlewareContext = {
  request: Request;
  version: string;
  params: Record<string, string>;
  next: (fields?: Record<string, unknown>) => Promise<Response>;
};

export type MiddlewareDefinition<Fields extends object = object> = {
  readonly [middlewareBrand]: true;
  readonly [middlewareFields]: Fields;
  handle: (input: MiddlewareContext) => Response | Promise<Response>;
};

type MiddlewareStep = {
  definition: MiddlewareDefinition<object>;
  allowFields: boolean;
};

type Passed<Result> = Result extends {
  readonly [passed]: infer Fields extends Record<string, unknown>;
}
  ? Fields
  : never;

type WithoutReserved<Fields> = {
  [Key in keyof Fields as Key extends ReservedField ? never : Key]: Fields[Key];
};

type MiddlewareFields<Result> = [Passed<Result>] extends [never]
  ? Record<never, never>
  : WithoutReserved<Passed<Result>>;

type MiddlewareNext = {
  (): Promise<Response & { readonly [passed]: Record<never, never> }>;
  <const Fields extends Record<string, unknown>>(
    fields: ForbidReserved<Fields>,
  ): Promise<Response & { readonly [passed]: Fields }>;
};

export function defineMiddleware<Result>(
  handle: (input: {
    request: Request;
    version: string;
    params: Record<string, string>;
    next: MiddlewareNext;
  }) => Promise<Result>,
): MiddlewareDefinition<MiddlewareFields<Result>> {
  return {
    [middlewareBrand]: true,
    [middlewareFields]: undefined as unknown as MiddlewareFields<Result>,
    handle,
  } as unknown as MiddlewareDefinition<MiddlewareFields<Result>>;
}

export function middlewareList(
  value: unknown,
): MiddlewareDefinition<object>[] | null {
  const exported = Array.isArray(value) ? value : [value];
  if (!exported.every(isMiddleware)) {
    return null;
  }
  return exported;
}

export function isMiddleware(
  value: unknown,
): value is MiddlewareDefinition<object> {
  return (
    typeof value === "object" &&
    value !== null &&
    middlewareBrand in value &&
    (value as Record<string, unknown>)[middlewareBrand] === true &&
    "handle" in value &&
    typeof value.handle === "function"
  );
}

export async function runMiddleware(
  steps: readonly MiddlewareStep[],
  context: {
    request: Request;
    version: string;
    params: Record<string, string>;
  },
  done: (fields: Record<string, unknown>) => Response | Promise<Response>,
) {
  const fields: Record<string, unknown> = {};
  let index = 0;
  const dispatch = async (): Promise<Response> => {
    const step = steps[index];
    index += 1;
    if (!step) {
      return done(fields);
    }
    let called = false;
    const response = await step.definition.handle({
      request: context.request,
      version: context.version,
      params: context.params,
      next: async (passed) => {
        if (called) {
          throw new Error("next() was already called");
        }
        called = true;
        if (passed !== undefined) {
          if (!isFieldBag(passed)) {
            throw new Error("next() values must be an object");
          }
          if (!step.allowFields && Object.keys(passed).length > 0) {
            throw new Error("Server middleware cannot pass values to next()");
          }
          for (const key of Object.keys(passed)) {
            if (reservedFields.includes(key as ReservedField)) {
              throw new Error(`Middleware cannot pass reserved field ${key}`);
            }
          }
          Object.assign(fields, passed);
        }
        return dispatch();
      },
    });
    if (!(response instanceof Response)) {
      throw new Error("Middleware must return a Response");
    }
    return response;
  };
  return dispatch();
}

function isFieldBag(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
