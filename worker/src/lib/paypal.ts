// PayPal REST API v2 — fetch-based, no SDK needed

interface PayPalEnv {
  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  PAYPAL_MODE?: string;
}

type PayPalCaptureResult = {
  status: string;
  captureId?: string;
  amount?: { currency_code?: string; value?: string };
};

type PayPalOrder = {
  id?: string; status?: string; links?: { rel: string; href: string }[];
  purchase_units?: { payments?: { captures?: { id?: string; status?: string; amount?: { currency_code?: string; value?: string } }[] } }[];
};

function baseUrl(mode: string): string {
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

async function getAccessToken(env: PayPalEnv): Promise<string> {
  const url = `${baseUrl(env.PAYPAL_MODE || 'sandbox')}/v1/oauth2/token`;
  const auth = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

function requestHeaders(token: string, requestId?: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (requestId) headers['PayPal-Request-Id'] = requestId;
  return headers;
}

function extractCapture(order: PayPalOrder): PayPalCaptureResult {
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  return {
    status: capture?.status || 'UNKNOWN',
    captureId: capture?.id,
    amount: capture?.amount,
  };
}

async function getOrder(env: PayPalEnv, orderId: string, token: string): Promise<PayPalOrder> {
  const url = `${baseUrl(env.PAYPAL_MODE || 'sandbox')}/v2/checkout/orders/${encodeURIComponent(orderId)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal order lookup failed: ${err}`);
  }
  return res.json() as Promise<PayPalOrder>;
}

function approvalLink(env: PayPalEnv, order: PayPalOrder) {
  const link = order.links?.find(item => item.rel === 'approve' || item.rel === 'payer-action')?.href;
  if (!link) throw new Error('PayPal approval is no longer available for this order');
  const url = new URL(link);
  const hosts = env.PAYPAL_MODE === 'live' ? ['www.paypal.com', 'paypal.com'] : ['www.sandbox.paypal.com', 'sandbox.paypal.com'];
  if (url.protocol !== 'https:' || !hosts.includes(url.hostname) || url.username || url.password || url.port) throw new Error('Invalid PayPal approval URL');
  return url.href;
}

export async function resumeOrder(env: PayPalEnv, orderId: string) {
  const order = await getOrder(env, orderId, await getAccessToken(env));
  if (order.status === 'APPROVED' || order.status === 'COMPLETED') return { captureRequired: true };
  if (order.status !== 'CREATED' && order.status !== 'PAYER_ACTION_REQUIRED') throw new Error('PayPal order cannot be resumed');
  return { approvalUrl: approvalLink(env, order) };
}

export async function createOrder(env: PayPalEnv, amount: number, currency: string, description: string, returnUrl: string, cancelUrl: string, requestId?: string) {
  const token = await getAccessToken(env);
  const url = `${baseUrl(env.PAYPAL_MODE || 'sandbox')}/v2/checkout/orders`;
  const res = await fetch(url, {
    method: 'POST',
    headers: requestHeaders(token, requestId),
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: { currency_code: currency, value: amount.toFixed(2) },
        description,
      }],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        brand_name: 'Yeppoon Seagulls Junior Rugby League',
        user_action: 'PAY_NOW',
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal create order failed: ${err}`);
  }
  const order = await res.json() as PayPalOrder;
  if (!order.id) throw new Error('PayPal create order failed: missing order ID');
  return { orderId: order.id, approvalUrl: approvalLink(env, order) };
}

export async function captureOrder(env: PayPalEnv, orderId: string, requestId?: string) {
  const token = await getAccessToken(env);
  const url = `${baseUrl(env.PAYPAL_MODE || 'sandbox')}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`;
  const res = await fetch(url, {
    method: 'POST',
    headers: requestHeaders(token, requestId),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    const err = await res.text();
    if (/ORDER_ALREADY_CAPTURED|ORDER_ALREADY_COMPLETED|already captured|already been captured/i.test(err)) {
      return extractCapture(await getOrder(env, orderId, token));
    }
    throw new Error(`PayPal capture failed: ${err}`);
  }
  return extractCapture(await res.json() as PayPalOrder);
}
