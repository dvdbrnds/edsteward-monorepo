--
-- EdSteward Database Schema
-- Compatible with PostgreSQL 15+
--

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

SET default_tablespace = '';
SET default_table_access_method = heap;

--
-- Name: comments; Type: TABLE; Schema: public
--

CREATE TABLE public.comments (
    id integer NOT NULL,
    regulation_id integer NOT NULL,
    user_id integer NOT NULL,
    content text NOT NULL,
    parent_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE SEQUENCE public.comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.comments_id_seq OWNED BY public.comments.id;

--
-- Name: deadlines; Type: TABLE; Schema: public
--

CREATE TABLE public.deadlines (
    id integer NOT NULL,
    regulation_id integer NOT NULL,
    due_date date NOT NULL,
    status text NOT NULL,
    assigned_to integer NOT NULL
);

CREATE SEQUENCE public.deadlines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.deadlines_id_seq OWNED BY public.deadlines.id;

--
-- Name: evidence_files; Type: TABLE; Schema: public
--

CREATE TABLE public.evidence_files (
    id integer NOT NULL,
    regulation_id integer NOT NULL,
    file_name text NOT NULL,
    file_size integer NOT NULL,
    file_type text NOT NULL,
    description text,
    uploaded_by integer NOT NULL,
    uploaded_at timestamp without time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    storage_path text NOT NULL
);

CREATE SEQUENCE public.evidence_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.evidence_files_id_seq OWNED BY public.evidence_files.id;

--
-- Name: guides; Type: TABLE; Schema: public
--

CREATE TABLE public.guides (
    id integer NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    category text NOT NULL,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer NOT NULL
);

CREATE SEQUENCE public.guides_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.guides_id_seq OWNED BY public.guides.id;

--
-- Name: notes; Type: TABLE; Schema: public
--

CREATE TABLE public.notes (
    id integer NOT NULL,
    regulation_id integer NOT NULL,
    user_id integer NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    is_private boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.notes_id_seq OWNED BY public.notes.id;

--
-- Name: notifications; Type: TABLE; Schema: public
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    regulation_id integer NOT NULL,
    user_id integer NOT NULL,
    message text NOT NULL,
    type text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;

--
-- Name: regulations; Type: TABLE; Schema: public
--

CREATE TABLE public.regulations (
    id integer NOT NULL,
    item_id text NOT NULL,
    name text NOT NULL,
    topic text NOT NULL,
    statute text NOT NULL,
    statute_ids text,
    summary text,
    requirements text,
    category text NOT NULL,
    jurisdiction text DEFAULT 'federal'::text NOT NULL,
    is_applicable boolean DEFAULT true NOT NULL,
    origination_date timestamp without time zone,
    effective_date timestamp without time zone,
    last_updated timestamp without time zone,
    last_verified timestamp without time zone,
    next_review_date timestamp without time zone,
    filing_deadlines jsonb,
    reporting_frequency text,
    agency_url text,
    agency_name text,
    agency_contact text,
    agency_department text,
    regulation_url text,
    requirements_url text,
    submission_guide_url text,
    forms_url text,
    submission_guidelines text,
    regulation_text text,
    applicable_forms jsonb,
    related_regulations jsonb,
    compliance_notes text,
    verification_method text,
    notification_schedule jsonb,
    sources jsonb,
    version_number integer DEFAULT 1 NOT NULL,
    previous_version_id integer,
    version_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    change_summary text,
    is_current boolean DEFAULT true NOT NULL,
    version_metadata jsonb,
    state_code text,
    state_agency text,
    actions jsonb,
    dro text DEFAULT ''::text NOT NULL,
    notification_override jsonb,
    sections jsonb
);

CREATE SEQUENCE public.regulations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.regulations_id_seq OWNED BY public.regulations.id;

--
-- Name: session; Type: TABLE; Schema: public
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);

--
-- Name: system_logs; Type: TABLE; Schema: public
--

CREATE TABLE public.system_logs (
    id integer NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL,
    facility integer NOT NULL,
    severity integer NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    hostname text NOT NULL,
    app_name text NOT NULL,
    proc_id text NOT NULL,
    msg_id text,
    structured_data jsonb,
    message text NOT NULL
);

CREATE SEQUENCE public.system_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.system_logs_id_seq OWNED BY public.system_logs.id;

--
-- Name: users; Type: TABLE; Schema: public
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    department text,
    email text DEFAULT ''::text NOT NULL,
    "firstName" text,
    "lastName" text,
    external_id text,
    provider_id text,
    identity_provider text,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

-- Set default values for sequences
ALTER TABLE ONLY public.comments ALTER COLUMN id SET DEFAULT nextval('public.comments_id_seq'::regclass);
ALTER TABLE ONLY public.deadlines ALTER COLUMN id SET DEFAULT nextval('public.deadlines_id_seq'::regclass);
ALTER TABLE ONLY public.evidence_files ALTER COLUMN id SET DEFAULT nextval('public.evidence_files_id_seq'::regclass);
ALTER TABLE ONLY public.guides ALTER COLUMN id SET DEFAULT nextval('public.guides_id_seq'::regclass);
ALTER TABLE ONLY public.notes ALTER COLUMN id SET DEFAULT nextval('public.notes_id_seq'::regclass);
ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);
ALTER TABLE ONLY public.regulations ALTER COLUMN id SET DEFAULT nextval('public.regulations_id_seq'::regclass);
ALTER TABLE ONLY public.system_logs ALTER COLUMN id SET DEFAULT nextval('public.system_logs_id_seq'::regclass);
ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

-- Add primary keys
ALTER TABLE ONLY public.comments ADD CONSTRAINT comments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.deadlines ADD CONSTRAINT deadlines_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.evidence_files ADD CONSTRAINT evidence_files_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.guides ADD CONSTRAINT guides_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.notes ADD CONSTRAINT notes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.regulations ADD CONSTRAINT regulations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.session ADD CONSTRAINT session_pkey PRIMARY KEY (sid);
ALTER TABLE ONLY public.system_logs ADD CONSTRAINT system_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);

-- Add unique constraints
ALTER TABLE ONLY public.regulations ADD CONSTRAINT regulations_item_id_key UNIQUE (item_id);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_username_key UNIQUE (username);

-- Add indexes for performance
CREATE INDEX idx_regulations_agency ON public.regulations USING btree (agency_name);
CREATE INDEX idx_regulations_category ON public.regulations USING btree (category);
CREATE INDEX idx_regulations_item_id ON public.regulations USING btree (item_id);
CREATE INDEX idx_regulations_itemid ON public.regulations USING btree (item_id);
CREATE INDEX idx_regulations_jurisdiction ON public.regulations USING btree (jurisdiction);
CREATE INDEX idx_regulations_last_updated ON public.regulations USING btree (last_updated);
CREATE INDEX idx_regulations_topic ON public.regulations USING btree (topic);
CREATE INDEX idx_users_email ON public.users USING btree (email);
CREATE INDEX idx_session_expire ON public.session USING btree (expire);

-- Add foreign key constraints
ALTER TABLE ONLY public.comments ADD CONSTRAINT comments_regulation_id_fkey FOREIGN KEY (regulation_id) REFERENCES public.regulations(id);
ALTER TABLE ONLY public.comments ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.deadlines ADD CONSTRAINT deadlines_regulation_id_fkey FOREIGN KEY (regulation_id) REFERENCES public.regulations(id);
ALTER TABLE ONLY public.deadlines ADD CONSTRAINT deadlines_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);
ALTER TABLE ONLY public.evidence_files ADD CONSTRAINT evidence_files_regulation_id_fkey FOREIGN KEY (regulation_id) REFERENCES public.regulations(id);
ALTER TABLE ONLY public.evidence_files ADD CONSTRAINT evidence_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.guides ADD CONSTRAINT guides_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.notes ADD CONSTRAINT notes_regulation_id_fkey FOREIGN KEY (regulation_id) REFERENCES public.regulations(id);
ALTER TABLE ONLY public.notes ADD CONSTRAINT notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_regulation_id_fkey FOREIGN KEY (regulation_id) REFERENCES public.regulations(id);
ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.regulations ADD CONSTRAINT regulations_previous_version_id_fkey FOREIGN KEY (previous_version_id) REFERENCES public.regulations(id); 