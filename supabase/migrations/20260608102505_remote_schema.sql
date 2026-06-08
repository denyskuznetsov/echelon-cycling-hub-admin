


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."discount_type" AS ENUM (
    'percentage',
    'fixed'
);


ALTER TYPE "public"."discount_type" OWNER TO "postgres";


CREATE TYPE "public"."fulfillment_type" AS ENUM (
    'pickup',
    'delivery'
);


ALTER TYPE "public"."fulfillment_type" OWNER TO "postgres";


CREATE TYPE "public"."order_status" AS ENUM (
    'new',
    'draft',
    'reserved',
    'started',
    'stopped',
    'canceled',
    'archived'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'manager',
    'partner',
    'mechanic'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE TYPE "public"."wiki_status" AS ENUM (
    'draft',
    'published'
);


ALTER TYPE "public"."wiki_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_partner_daily_stats"("p_partner_id" "uuid", "p_start_date" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("stat_date" "date", "daily_orders" bigint, "daily_cents" bigint)
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  SELECT 
    DATE(created_at) AS stat_date,
    COUNT(id) AS daily_orders,
    COALESCE(SUM(amount_in_cents), 0) AS daily_cents
  FROM public.orders
  WHERE partner_id = p_partner_id
    -- AND status != 'canceled' -- Safely excludes canceled orders
    AND (p_start_date IS NULL OR created_at >= p_start_date) -- URL Timeframe Filter
  GROUP BY DATE(created_at)
  ORDER BY stat_date ASC;
$$;


ALTER FUNCTION "public"."get_partner_daily_stats"("p_partner_id" "uuid", "p_start_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"() RETURNS "public"."user_role"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    -- If no role is provided in metadata, default to mechanic
    COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'mechanic'::public.user_role)
  );
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wiki_categories_before_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := nullif(public.wiki_slugify(new.name), '');
    if new.slug is null then
      new.slug := 'category';
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."wiki_categories_before_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wiki_documents_before_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  base text;
  suffix text;
begin
  base := nullif(public.wiki_slugify(new.title), '');
  if base is null then
    base := 'untitled-document';
  end if;
  suffix := substr(replace(new.id::text, '-', ''), 1, 8);

  if tg_op = 'INSERT' then
    if new.slug is null or new.slug = '' then
      new.slug := base || '-' || suffix;
    end if;
    if new.status = 'published' and new.published_at is null then
      new.published_at := now();
    end if;
  elsif tg_op = 'UPDATE' then
    if new.status = 'published' and old.published_at is null then
      new.published_at := now();
    end if;
    if old.published_at is null then
      new.slug := base || '-' || suffix;
    else
      new.slug := old.slug;
    end if;
    new.updated_at := now();
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."wiki_documents_before_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wiki_slugify"("value" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g'));
$$;


ALTER FUNCTION "public"."wiki_slugify"("value" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."bike_fits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fit_number" integer NOT NULL,
    "customer_id" "uuid",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "parent_fit_id" "uuid",
    "date_of_fit" "date" DEFAULT CURRENT_DATE NOT NULL,
    "bike_type" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "fit_label" "text" DEFAULT 'Baseline Fit'::"text" NOT NULL,
    "assessment_payload" "jsonb" DEFAULT '{}'::"jsonb",
    "new_bike_fit_payload" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "report_storage_path" "text",
    "report_generated_at" timestamp with time zone,
    CONSTRAINT "bike_fits_bike_type_check" CHECK (("bike_type" = ANY (ARRAY['road'::"text", 'gravel'::"text", 'TT'::"text", 'MTB'::"text", 'city'::"text"]))),
    CONSTRAINT "bike_fits_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'in_progress'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."bike_fits" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."bike_fits_fit_number_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."bike_fits_fit_number_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."bike_fits_fit_number_seq" OWNED BY "public"."bike_fits"."fit_number";



CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booqable_customer_id" "text",
    "name" "text",
    "email" "text",
    "phone" "text",
    "birthday" "date",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "sex" "text",
    CONSTRAINT "customers_sex_check" CHECK ((("sex" IS NULL) OR ("sex" = ANY (ARRAY['male'::"text", 'female'::"text"]))))
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."customers"."sex" IS 'Customer sex: male or female';



CREATE OR REPLACE VIEW "public"."bike_fits_view" WITH ("security_invoker"='true') AS
 SELECT "bf"."id",
    "bf"."fit_number",
    ("bf"."fit_number")::"text" AS "fit_number_text",
    "bf"."customer_id",
    "c"."name" AS "customer_name",
    "c"."email" AS "customer_email",
    "c"."phone" AS "customer_phone",
    "bf"."created_by",
    "bf"."parent_fit_id",
    "bf"."date_of_fit",
    "bf"."bike_type",
    "bf"."status",
    "bf"."fit_label",
    "bf"."created_at",
    "bf"."updated_at"
   FROM ("public"."bike_fits" "bf"
     LEFT JOIN "public"."customers" "c" ON (("c"."id" = "bf"."customer_id")));


ALTER VIEW "public"."bike_fits_view" OWNER TO "postgres";


COMMENT ON VIEW "public"."bike_fits_view" IS 'Read model for bike fit list/search. Joins customer display fields; RLS enforced via security_invoker on base tables.';



CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booqable_order_id" "text" NOT NULL,
    "order_number" integer,
    "status" "public"."order_status" DEFAULT 'new'::"public"."order_status" NOT NULL,
    "fulfillment_type" "public"."fulfillment_type",
    "starts_at" timestamp with time zone,
    "stops_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "delivery_address" "text",
    "billing_address" "text",
    "amount_in_cents" integer DEFAULT 0 NOT NULL,
    "coupon_id" "uuid",
    "coupon_discount_in_cents" integer,
    "discount_type" "public"."discount_type",
    "discount_percentage" numeric,
    "partner_id" "uuid",
    "customer_id" "uuid",
    "partner_promo" "text",
    "coupon_code_value" integer
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."partners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "promo_code" "text",
    "commission_rate" numeric DEFAULT 0.10 NOT NULL,
    "location" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "hero_image_url" "text"
);


ALTER TABLE "public"."partners" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."bookings_view" WITH ("security_invoker"='true') AS
 SELECT "o"."id",
    "o"."booqable_order_id",
    "o"."order_number",
    ("o"."order_number")::"text" AS "order_number_text",
    "o"."status",
    "o"."starts_at",
    "o"."stops_at",
    "o"."amount_in_cents",
    "o"."partner_id",
    "o"."created_at",
    "c"."name" AS "customer_name",
    "c"."email" AS "customer_email",
    "c"."phone" AS "customer_phone",
    "p"."name" AS "partner_name",
    "p"."slug" AS "partner_slug"
   FROM (("public"."orders" "o"
     LEFT JOIN "public"."customers" "c" ON (("o"."customer_id" = "c"."id")))
     LEFT JOIN "public"."partners" "p" ON (("o"."partner_id" = "p"."id")))
  WHERE (("o"."order_number" IS NOT NULL) AND ("o"."status" <> 'new'::"public"."order_status"));


ALTER VIEW "public"."bookings_view" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."partner_customers_view" WITH ("security_invoker"='true') AS
 SELECT "c"."id",
    "c"."name",
    "c"."email",
    "c"."phone",
    "c"."birthday",
    "o"."partner_id",
    "array_agg"("o"."order_number") AS "order_numbers",
    "array_to_string"("array_agg"("o"."order_number"), ', '::"text") AS "order_numbers_text"
   FROM ("public"."customers" "c"
     JOIN "public"."orders" "o" ON (("c"."id" = "o"."customer_id")))
  WHERE (("o"."partner_id" IS NOT NULL) AND ("o"."order_number" IS NOT NULL) AND ("o"."status" <> 'new'::"public"."order_status"))
  GROUP BY "c"."id", "c"."name", "c"."email", "c"."phone", "c"."birthday", "o"."partner_id";


ALTER VIEW "public"."partner_customers_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "role" "public"."user_role" DEFAULT 'mechanic'::"public"."user_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "partner_id" "uuid"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wiki_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "color" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."wiki_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wiki_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" DEFAULT 'Untitled Document'::"text" NOT NULL,
    "slug" "text" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "status" "public"."wiki_status" DEFAULT 'draft'::"public"."wiki_status" NOT NULL,
    "category_id" "uuid",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."wiki_documents" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."wiki_documents_view" WITH ("security_invoker"='true') AS
 SELECT "d"."id",
    "d"."title",
    "d"."slug",
    "d"."content",
    "d"."status",
    "d"."category_id",
    "c"."name" AS "category_name",
    "c"."slug" AS "category_slug",
    "c"."color" AS "category_color",
    "d"."published_at",
    "d"."created_at",
    "d"."updated_at"
   FROM ("public"."wiki_documents" "d"
     LEFT JOIN "public"."wiki_categories" "c" ON (("c"."id" = "d"."category_id")));


ALTER VIEW "public"."wiki_documents_view" OWNER TO "postgres";


ALTER TABLE ONLY "public"."bike_fits" ALTER COLUMN "fit_number" SET DEFAULT "nextval"('"public"."bike_fits_fit_number_seq"'::"regclass");



ALTER TABLE ONLY "public"."bike_fits"
    ADD CONSTRAINT "bike_fits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_booqable_customer_id_key" UNIQUE ("booqable_customer_id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_booqable_order_id_key" UNIQUE ("booqable_order_id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partners"
    ADD CONSTRAINT "partners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partners"
    ADD CONSTRAINT "partners_promo_code_key" UNIQUE ("promo_code");



ALTER TABLE ONLY "public"."partners"
    ADD CONSTRAINT "partners_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wiki_categories"
    ADD CONSTRAINT "wiki_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wiki_categories"
    ADD CONSTRAINT "wiki_categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."wiki_documents"
    ADD CONSTRAINT "wiki_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wiki_documents"
    ADD CONSTRAINT "wiki_documents_slug_key" UNIQUE ("slug");



CREATE INDEX "wiki_documents_category_id_idx" ON "public"."wiki_documents" USING "btree" ("category_id");



CREATE INDEX "wiki_documents_created_at_idx" ON "public"."wiki_documents" USING "btree" ("created_at" DESC);



CREATE INDEX "wiki_documents_status_idx" ON "public"."wiki_documents" USING "btree" ("status");



CREATE INDEX "wiki_documents_updated_at_idx" ON "public"."wiki_documents" USING "btree" ("updated_at" DESC);



CREATE OR REPLACE TRIGGER "wiki_categories_before_write" BEFORE INSERT OR UPDATE ON "public"."wiki_categories" FOR EACH ROW EXECUTE FUNCTION "public"."wiki_categories_before_write"();



CREATE OR REPLACE TRIGGER "wiki_documents_before_write" BEFORE INSERT OR UPDATE ON "public"."wiki_documents" FOR EACH ROW EXECUTE FUNCTION "public"."wiki_documents_before_write"();



ALTER TABLE ONLY "public"."bike_fits"
    ADD CONSTRAINT "bike_fits_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."bike_fits"
    ADD CONSTRAINT "bike_fits_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bike_fits"
    ADD CONSTRAINT "bike_fits_parent_fit_id_fkey" FOREIGN KEY ("parent_fit_id") REFERENCES "public"."bike_fits"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wiki_documents"
    ADD CONSTRAINT "wiki_documents_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."wiki_categories"("id") ON DELETE SET NULL;



CREATE POLICY "Admins and managers can manage categories" ON "public"."wiki_categories" TO "authenticated" USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"]))) WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"])));



CREATE POLICY "Admins and managers can manage documents" ON "public"."wiki_documents" TO "authenticated" USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"]))) WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"])));



CREATE POLICY "Admins and managers can view all partners" ON "public"."partners" FOR SELECT USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"])));



CREATE POLICY "Admins and managers can view all profiles" ON "public"."profiles" FOR SELECT USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"])));



CREATE POLICY "Admins see all orders" ON "public"."orders" FOR SELECT USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"])));



CREATE POLICY "Partners can read customers on their orders" ON "public"."customers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."customer_id" = "customers"."id") AND ("o"."partner_id" = ( SELECT "profiles"."partner_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))));



CREATE POLICY "Partners can view own partner data" ON "public"."partners" FOR SELECT USING (("id" = ( SELECT "profiles"."partner_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Partners see own orders" ON "public"."orders" FOR SELECT USING (("partner_id" = ( SELECT "profiles"."partner_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Staff can insert customers" ON "public"."customers" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"])));



CREATE POLICY "Staff can manage all bike fits" ON "public"."bike_fits" USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"])));



CREATE POLICY "Staff can read all customers" ON "public"."customers" FOR SELECT USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"])));



CREATE POLICY "Staff can read categories" ON "public"."wiki_categories" FOR SELECT TO "authenticated" USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'mechanic'::"public"."user_role"])));



CREATE POLICY "Staff can read published documents" ON "public"."wiki_documents" FOR SELECT TO "authenticated" USING ((("status" = 'published'::"public"."wiki_status") AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'mechanic'::"public"."user_role"]))));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."bike_fits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wiki_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wiki_documents" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."customers";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."orders";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."get_partner_daily_stats"("p_partner_id" "uuid", "p_start_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_partner_daily_stats"("p_partner_id" "uuid", "p_start_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_partner_daily_stats"("p_partner_id" "uuid", "p_start_date" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."wiki_categories_before_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."wiki_categories_before_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."wiki_categories_before_write"() TO "service_role";



GRANT ALL ON FUNCTION "public"."wiki_documents_before_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."wiki_documents_before_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."wiki_documents_before_write"() TO "service_role";



GRANT ALL ON FUNCTION "public"."wiki_slugify"("value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."wiki_slugify"("value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."wiki_slugify"("value" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."bike_fits" TO "anon";
GRANT ALL ON TABLE "public"."bike_fits" TO "authenticated";
GRANT ALL ON TABLE "public"."bike_fits" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bike_fits_fit_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bike_fits_fit_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bike_fits_fit_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."bike_fits_view" TO "anon";
GRANT ALL ON TABLE "public"."bike_fits_view" TO "authenticated";
GRANT ALL ON TABLE "public"."bike_fits_view" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."partners" TO "anon";
GRANT ALL ON TABLE "public"."partners" TO "authenticated";
GRANT ALL ON TABLE "public"."partners" TO "service_role";



GRANT ALL ON TABLE "public"."bookings_view" TO "anon";
GRANT ALL ON TABLE "public"."bookings_view" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings_view" TO "service_role";



GRANT ALL ON TABLE "public"."partner_customers_view" TO "anon";
GRANT ALL ON TABLE "public"."partner_customers_view" TO "authenticated";
GRANT ALL ON TABLE "public"."partner_customers_view" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."wiki_categories" TO "anon";
GRANT ALL ON TABLE "public"."wiki_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."wiki_categories" TO "service_role";



GRANT ALL ON TABLE "public"."wiki_documents" TO "anon";
GRANT ALL ON TABLE "public"."wiki_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."wiki_documents" TO "service_role";



GRANT ALL ON TABLE "public"."wiki_documents_view" TO "anon";
GRANT ALL ON TABLE "public"."wiki_documents_view" TO "authenticated";
GRANT ALL ON TABLE "public"."wiki_documents_view" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Staff can delete bike fit reference images"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'bike-fit-images'::text) AND (public.get_user_role() = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role]))));



  create policy "Staff can replace bike fit reference images"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'bike-fit-images'::text) AND (public.get_user_role() = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role]))))
with check (((bucket_id = 'bike-fit-images'::text) AND (public.get_user_role() = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role]))));



  create policy "Staff can upload bike fit reference images"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'bike-fit-images'::text) AND (public.get_user_role() = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role]))));



  create policy "Staff can view bike fit reference images"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'bike-fit-images'::text) AND (public.get_user_role() = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role]))));



