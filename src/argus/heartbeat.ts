import type { ArgusConfig } from "../project/config.ts";
import type { ServiceIdentity } from "../server/identity.ts";
import {
  type ArgusFetch,
  argusRegistrations,
  publishArgus,
  withdrawArgus,
} from "./register.ts";

export const argusHeartbeatMs = 10_000;

export function startArgusHeartbeat(options: {
  argus: ArgusConfig;
  identity: ServiceIdentity;
  version?: string;
  fetchImpl?: ArgusFetch;
  intervalMs?: number;
  log?: (message: string) => void;
}) {
  const log = options.log ?? ((message: string) => console.error(message));
  const registrations = () =>
    argusRegistrations({
      identity: options.identity,
      argus: options.argus,
      version: options.version,
    });
  const beat = async () => {
    const errors = await publishArgus({
      url: options.argus.url,
      username: options.argus.username,
      password: options.argus.password,
      registrations: registrations(),
      fetchImpl: options.fetchImpl,
    });
    for (const error of errors) {
      log(`Argus register failed: ${error}`);
    }
  };
  void beat();
  const timer = setInterval(() => {
    void beat();
  }, options.intervalMs ?? argusHeartbeatMs);
  timer.unref?.();
  let stopped = false;
  return async () => {
    if (stopped) {
      return;
    }
    stopped = true;
    clearInterval(timer);
    const errors = await withdrawArgus({
      url: options.argus.url,
      username: options.argus.username,
      password: options.argus.password,
      registrations: registrations(),
      fetchImpl: options.fetchImpl,
    });
    for (const error of errors) {
      log(`Argus deregister failed: ${error}`);
    }
  };
}
