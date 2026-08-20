import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type CounterKey = string;

const counters = new Map<CounterKey, number>();
const startedAt = Date.now();

function label(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function increment(method: string, route: string, status: number): void {
  const key = `${method}\u0000${route}\u0000${status}`;
  counters.set(key, (counters.get(key) ?? 0) + 1);
}

function renderMetrics(): string {
  const lines = [
    '# HELP erf_api_uptime_seconds Process uptime in seconds.',
    '# TYPE erf_api_uptime_seconds gauge',
    `erf_api_uptime_seconds ${((Date.now() - startedAt) / 1000).toFixed(3)}`,
    '# HELP erf_http_requests_total Total HTTP responses served by the API.',
    '# TYPE erf_http_requests_total counter'
  ];

  for (const [key, count] of counters) {
    const [method, route, status] = key.split('\u0000');
    lines.push(`erf_http_requests_total{method="${label(method)}",route="${label(route)}",status="${label(status)}"} ${count}`);
  }
  return `${lines.join('\n')}\n`;
}

export function registerMetrics(app: FastifyInstance): void {
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const route = request.routeOptions.url ?? request.url;
    if (route !== '/metrics') increment(request.method, route, reply.statusCode);
  });

  app.get('/metrics', async (_request, reply) => {
    return reply.type('text/plain; version=0.0.4; charset=utf-8').send(renderMetrics());
  });
}

