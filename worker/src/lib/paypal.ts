// PayPal REST API v2 — fetch-based, no SDK needed

interface PayPalEnv {
  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  PAYPAL_MODE: string;
}

function baseUrl(mode: string): string {
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

async function getAccessToken(env: PayPalEnv): Promise<string> {
  const url = `${baseUrl(env.PAYPAL_MODE)}/v1/oauth2/token`;
  const auth = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

export async function createOrder(env: PayPalEnv, amount: number, currency: string, description: string, returnUrl: string, cancelUrl: string) {
  const token = await getAccessToken(env);
  const url = `${baseUrl(env.PAYPAL_MODE)}/v2/checkout/orders`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
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
  const order = await res.json() as { id: string; links: { rel: string; href: string }[] };
  const approvalUrl = order.links.find((l: { rel: string }) => l.rel === 'approve')?.href;
  return { orderId: order.id, approvalUrl };
}

export async function captureOrder(env: PayPalEnv, orderId: string) {
  const token = await getAccessToken(env);
  const url = `${baseUrl(env.PAYPAL_MODE)}/v2/checkout/orders/${orderId}/capture`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal capture failed: ${err}`);
  }
  const capture = await res.json() as {
    id: string;
    status: string;
    purchase_units: { payments: { captures: { id: string }[] } }[];
  };
  const captureId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id;
  return { status: capture.status, captureId };
}
