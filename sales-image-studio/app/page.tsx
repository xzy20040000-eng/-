import { getPageUser } from "../lib/phone-auth";
import Studio from "./studio";
import Login from "./login";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getPageUser();
  return user ? <Studio phone={user.phone} /> : <Login />;
}
