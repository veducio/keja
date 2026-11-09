export function swapProjectHandlers(
  servers: {
    publicServer: {
      reload: (options: {
        fetch: (request: Request) => Response | Promise<Response>;
      }) => void;
    };
    serviceServer: {
      reload: (options: {
        fetch: (request: Request) => Response | Promise<Response>;
      }) => void;
    };
  },
  apps: {
    publicApp: {
      fetch: (request: Request) => Response | Promise<Response>;
    };
    serviceApp: {
      fetch: (request: Request) => Response | Promise<Response>;
    };
  },
) {
  servers.publicServer.reload({
    fetch: (request) => apps.publicApp.fetch(request),
  });
  servers.serviceServer.reload({
    fetch: (request) => apps.serviceApp.fetch(request),
  });
}
