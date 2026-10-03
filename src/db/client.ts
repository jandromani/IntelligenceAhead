import postgres from "postgres";

let client: ReturnType<typeof postgres> | null = null;

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDatabase() {
  const url=process.env.DATABASE_URL;
  if(!url) return null;
  if(!client){
    client=postgres(url,{
      max:5,
      idle_timeout:20,
      connect_timeout:10,
      prepare:false,
    });
  }
  return client;
}
