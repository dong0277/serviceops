export type DemoServiceKey = "cleaning" | "repair" | "training";
export type DemoStaffKey = "hana" | "jun";
export type DemoCustomerKey = "sora" | "yun" | "min";

const serviceKeysByName: Record<string, DemoServiceKey> = {
  "정기 청소": "cleaning",
  "방문 수리": "repair",
  "1:1 트레이닝": "training",
};

const staffKeysByName: Record<string, DemoStaffKey> = {
  "이하나 기사": "hana",
  "박준호 기사": "jun",
};

const customerKeysByEmail: Record<string, DemoCustomerKey> = {
  "customer.sora@serviceops.test": "sora",
  "customer.yun@serviceops.test": "yun",
  "customer.min@serviceops.test": "min",
};

const customerKeysByName: Record<string, DemoCustomerKey> = {
  "최소라 고객": "sora",
  "정윤서 고객": "yun",
  "한민지 고객": "min",
};

export function getDemoServiceKey(name: string) {
  return serviceKeysByName[name] ?? null;
}

export function getDemoStaffKey(name: string) {
  return staffKeysByName[name] ?? null;
}

export function getDemoCustomerKey(email: string) {
  return customerKeysByEmail[email] ?? null;
}

export function getDemoCustomerKeyByName(name: string) {
  return customerKeysByName[name] ?? null;
}
