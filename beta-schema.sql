--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


SET default_table_access_method = heap;

--
-- Name: branding_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branding_configurations (
    id integer NOT NULL,
    config_data jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: branding_configurations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.branding_configurations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: branding_configurations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.branding_configurations_id_seq OWNED BY public.branding_configurations.id;


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id integer NOT NULL,
    regulation_id integer NOT NULL,
    user_id integer NOT NULL,
    content text NOT NULL,
    parent_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comments_id_seq OWNED BY public.comments.id;


--
-- Name: deadlines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deadlines (
    id integer NOT NULL,
    regulation_id integer NOT NULL,
    due_date date NOT NULL,
    status text NOT NULL,
    assigned_to integer NOT NULL
);


--
-- Name: deadlines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.deadlines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: deadlines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.deadlines_id_seq OWNED BY public.deadlines.id;


--
-- Name: evidence_files; Type: TABLE; Schema: public; Owner: -
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
    storage_path text NOT NULL,
    is_official boolean DEFAULT false NOT NULL
);


--
-- Name: evidence_files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.evidence_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evidence_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.evidence_files_id_seq OWNED BY public.evidence_files.id;


--
-- Name: guides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guides (
    id integer NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    category text NOT NULL,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer NOT NULL
);


--
-- Name: guides_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.guides_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: guides_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.guides_id_seq OWNED BY public.guides.id;


--
-- Name: institution_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institution_configurations (
    id integer NOT NULL,
    tenant_id text NOT NULL,
    primary_types jsonb DEFAULT '[]'::jsonb NOT NULL,
    hide_non_applicable boolean DEFAULT true NOT NULL,
    allow_users_to_toggle boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: institution_configurations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.institution_configurations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: institution_configurations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.institution_configurations_id_seq OWNED BY public.institution_configurations.id;


--
-- Name: notes; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: notes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notes_id_seq OWNED BY public.notes.id;


--
-- Name: notification_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_queue (
    id integer NOT NULL,
    regulation_id integer NOT NULL,
    user_id integer,
    type text NOT NULL,
    content jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    sent_at timestamp without time zone,
    priority text DEFAULT 'normal'::text NOT NULL,
    retry_count integer DEFAULT 0 NOT NULL,
    next_retry_at timestamp without time zone
);


--
-- Name: notification_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_queue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_queue_id_seq OWNED BY public.notification_queue.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    regulation_id integer NOT NULL,
    user_id integer NOT NULL,
    type text NOT NULL,
    frequency text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    phone_number text
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: regulation_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regulation_versions (
    id integer NOT NULL,
    regulation_id integer NOT NULL,
    version_number integer NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by integer,
    source text DEFAULT 'local'::text NOT NULL,
    source_id text,
    validation_status jsonb
);


--
-- Name: regulation_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.regulation_versions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: regulation_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.regulation_versions_id_seq OWNED BY public.regulation_versions.id;


--
-- Name: regulations; Type: TABLE; Schema: public; Owner: -
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
    sections jsonb,
    jurisdiction_source text DEFAULT 'federal'::text NOT NULL,
    applicable_institutions jsonb
);


--
-- Name: regulations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.regulations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: regulations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.regulations_id_seq OWNED BY public.regulations.id;


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


--
-- Name: sync_control; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_control (
    id integer NOT NULL,
    regulation_id integer NOT NULL,
    last_sync_attempt timestamp without time zone,
    last_successful_sync timestamp without time zone,
    sync_errors jsonb,
    next_scheduled_sync timestamp without time zone,
    sync_state text DEFAULT 'idle'::text NOT NULL,
    sync_settings jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: sync_control_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sync_control_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sync_control_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sync_control_id_seq OWNED BY public.sync_control.id;


--
-- Name: system_logs; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: system_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_logs_id_seq OWNED BY public.system_logs.id;


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id text NOT NULL,
    name text NOT NULL,
    domain text NOT NULL,
    subdomain text NOT NULL,
    database_name text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    saml_config jsonb,
    settings jsonb DEFAULT '{"defaultRole": "user", "allowedDomains": [], "enableAutoProvisioning": false}'::jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: validation_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.validation_status (
    id integer NOT NULL,
    regulation_id integer NOT NULL,
    version_id integer,
    level text NOT NULL,
    status text NOT NULL,
    details jsonb,
    validated_at timestamp without time zone DEFAULT now() NOT NULL,
    validated_by integer
);


--
-- Name: validation_status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.validation_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: validation_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.validation_status_id_seq OWNED BY public.validation_status.id;


--
-- Name: version_conflicts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.version_conflicts (
    id integer NOT NULL,
    regulation_id integer NOT NULL,
    local_version_id integer,
    remote_version_id text NOT NULL,
    conflicts jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    resolution_method text,
    resolved_at timestamp without time zone,
    resolved_by integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: version_conflicts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.version_conflicts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: version_conflicts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.version_conflicts_id_seq OWNED BY public.version_conflicts.id;


--
-- Name: branding_configurations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branding_configurations ALTER COLUMN id SET DEFAULT nextval('public.branding_configurations_id_seq'::regclass);


--
-- Name: comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments ALTER COLUMN id SET DEFAULT nextval('public.comments_id_seq'::regclass);


--
-- Name: deadlines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deadlines ALTER COLUMN id SET DEFAULT nextval('public.deadlines_id_seq'::regclass);


--
-- Name: evidence_files id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence_files ALTER COLUMN id SET DEFAULT nextval('public.evidence_files_id_seq'::regclass);


--
-- Name: guides id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guides ALTER COLUMN id SET DEFAULT nextval('public.guides_id_seq'::regclass);


--
-- Name: institution_configurations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_configurations ALTER COLUMN id SET DEFAULT nextval('public.institution_configurations_id_seq'::regclass);


--
-- Name: notes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes ALTER COLUMN id SET DEFAULT nextval('public.notes_id_seq'::regclass);


--
-- Name: notification_queue id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_queue ALTER COLUMN id SET DEFAULT nextval('public.notification_queue_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: regulation_versions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulation_versions ALTER COLUMN id SET DEFAULT nextval('public.regulation_versions_id_seq'::regclass);


--
-- Name: regulations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulations ALTER COLUMN id SET DEFAULT nextval('public.regulations_id_seq'::regclass);


--
-- Name: sync_control id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_control ALTER COLUMN id SET DEFAULT nextval('public.sync_control_id_seq'::regclass);


--
-- Name: system_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_logs ALTER COLUMN id SET DEFAULT nextval('public.system_logs_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: validation_status id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validation_status ALTER COLUMN id SET DEFAULT nextval('public.validation_status_id_seq'::regclass);


--
-- Name: version_conflicts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.version_conflicts ALTER COLUMN id SET DEFAULT nextval('public.version_conflicts_id_seq'::regclass);


--
-- Name: branding_configurations branding_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branding_configurations
    ADD CONSTRAINT branding_configurations_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: deadlines deadlines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deadlines
    ADD CONSTRAINT deadlines_pkey PRIMARY KEY (id);


--
-- Name: evidence_files evidence_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence_files
    ADD CONSTRAINT evidence_files_pkey PRIMARY KEY (id);


--
-- Name: guides guides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guides
    ADD CONSTRAINT guides_pkey PRIMARY KEY (id);


--
-- Name: institution_configurations institution_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_configurations
    ADD CONSTRAINT institution_configurations_pkey PRIMARY KEY (id);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- Name: notification_queue notification_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_queue
    ADD CONSTRAINT notification_queue_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: regulation_versions regulation_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulation_versions
    ADD CONSTRAINT regulation_versions_pkey PRIMARY KEY (id);


--
-- Name: regulations regulations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulations
    ADD CONSTRAINT regulations_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: sync_control sync_control_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_control
    ADD CONSTRAINT sync_control_pkey PRIMARY KEY (id);


--
-- Name: system_logs system_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_logs
    ADD CONSTRAINT system_logs_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_subdomain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_subdomain_key UNIQUE (subdomain);


--
-- Name: institution_configurations unique_tenant_config; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_configurations
    ADD CONSTRAINT unique_tenant_config UNIQUE (tenant_id);


--
-- Name: users users_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_external_id_key UNIQUE (external_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: validation_status validation_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validation_status
    ADD CONSTRAINT validation_status_pkey PRIMARY KEY (id);


--
-- Name: version_conflicts version_conflicts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.version_conflicts
    ADD CONSTRAINT version_conflicts_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- Name: idx_institution_configurations_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_institution_configurations_tenant_id ON public.institution_configurations USING btree (tenant_id);


--
-- Name: idx_notification_queue_regulation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_queue_regulation_id ON public.notification_queue USING btree (regulation_id);


--
-- Name: idx_notification_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_queue_status ON public.notification_queue USING btree (status);


--
-- Name: idx_regulation_versions_regulation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_regulation_versions_regulation_id ON public.regulation_versions USING btree (regulation_id);


--
-- Name: idx_regulations_agency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_regulations_agency ON public.regulations USING btree (agency_name);


--
-- Name: idx_regulations_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_regulations_category ON public.regulations USING btree (category);


--
-- Name: idx_regulations_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_regulations_item_id ON public.regulations USING btree (item_id);


--
-- Name: idx_regulations_itemid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_regulations_itemid ON public.regulations USING btree (item_id);


--
-- Name: idx_regulations_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_regulations_jurisdiction ON public.regulations USING btree (jurisdiction);


--
-- Name: idx_regulations_last_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_regulations_last_updated ON public.regulations USING btree (last_updated);


--
-- Name: idx_regulations_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_regulations_topic ON public.regulations USING btree (topic);


--
-- Name: idx_sync_control_regulation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_control_regulation_id ON public.sync_control USING btree (regulation_id);


--
-- Name: idx_validation_status_regulation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_validation_status_regulation_id ON public.validation_status USING btree (regulation_id);


--
-- Name: idx_validation_status_version_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_validation_status_version_id ON public.validation_status USING btree (version_id);


--
-- Name: idx_version_conflicts_regulation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_version_conflicts_regulation_id ON public.version_conflicts USING btree (regulation_id);


--
-- Name: idx_version_conflicts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_version_conflicts_status ON public.version_conflicts USING btree (status);


--
-- Name: notification_queue notification_queue_regulation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_queue
    ADD CONSTRAINT notification_queue_regulation_id_fkey FOREIGN KEY (regulation_id) REFERENCES public.regulations(id);


--
-- Name: notification_queue notification_queue_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_queue
    ADD CONSTRAINT notification_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: regulation_versions regulation_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulation_versions
    ADD CONSTRAINT regulation_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: regulation_versions regulation_versions_regulation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulation_versions
    ADD CONSTRAINT regulation_versions_regulation_id_fkey FOREIGN KEY (regulation_id) REFERENCES public.regulations(id);


--
-- Name: regulations regulations_previous_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulations
    ADD CONSTRAINT regulations_previous_version_id_fkey FOREIGN KEY (previous_version_id) REFERENCES public.regulations(id);


--
-- Name: sync_control sync_control_regulation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_control
    ADD CONSTRAINT sync_control_regulation_id_fkey FOREIGN KEY (regulation_id) REFERENCES public.regulations(id);


--
-- Name: validation_status validation_status_regulation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validation_status
    ADD CONSTRAINT validation_status_regulation_id_fkey FOREIGN KEY (regulation_id) REFERENCES public.regulations(id);


--
-- Name: validation_status validation_status_validated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validation_status
    ADD CONSTRAINT validation_status_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES public.users(id);


--
-- Name: validation_status validation_status_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validation_status
    ADD CONSTRAINT validation_status_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.regulation_versions(id);


--
-- Name: version_conflicts version_conflicts_local_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.version_conflicts
    ADD CONSTRAINT version_conflicts_local_version_id_fkey FOREIGN KEY (local_version_id) REFERENCES public.regulation_versions(id);


--
-- Name: version_conflicts version_conflicts_regulation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.version_conflicts
    ADD CONSTRAINT version_conflicts_regulation_id_fkey FOREIGN KEY (regulation_id) REFERENCES public.regulations(id);


--
-- Name: version_conflicts version_conflicts_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.version_conflicts
    ADD CONSTRAINT version_conflicts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

