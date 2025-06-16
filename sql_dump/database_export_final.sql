-- Database structure and data dump
-- Generated on Mon 31 Mar 2025 04:50:21 PM UTC

--
-- PostgreSQL database dump
--

-- Dumped from database version 16.8
-- Dumped by pg_dump version 16.5

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
-- Name: comments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.comments (
    id integer NOT NULL,
    regulation_id integer NOT NULL,
    user_id integer NOT NULL,
    content text NOT NULL,
    parent_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.comments OWNER TO neondb_owner;

--
-- Name: comments_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comments_id_seq OWNER TO neondb_owner;

--
-- Name: comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.comments_id_seq OWNED BY public.comments.id;


--
-- Name: deadlines; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.deadlines (
    id integer NOT NULL,
    regulation_id integer NOT NULL,
    due_date date NOT NULL,
    status text NOT NULL,
    assigned_to integer NOT NULL
);


ALTER TABLE public.deadlines OWNER TO neondb_owner;

--
-- Name: deadlines_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.deadlines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.deadlines_id_seq OWNER TO neondb_owner;

--
-- Name: deadlines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.deadlines_id_seq OWNED BY public.deadlines.id;


--
-- Name: evidence_files; Type: TABLE; Schema: public; Owner: neondb_owner
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


ALTER TABLE public.evidence_files OWNER TO neondb_owner;

--
-- Name: evidence_files_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.evidence_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.evidence_files_id_seq OWNER TO neondb_owner;

--
-- Name: evidence_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.evidence_files_id_seq OWNED BY public.evidence_files.id;


--
-- Name: guides; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.guides (
    id integer NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    category text NOT NULL,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer NOT NULL
);


ALTER TABLE public.guides OWNER TO neondb_owner;

--
-- Name: guides_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.guides_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.guides_id_seq OWNER TO neondb_owner;

--
-- Name: guides_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.guides_id_seq OWNED BY public.guides.id;


--
-- Name: notes; Type: TABLE; Schema: public; Owner: neondb_owner
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


ALTER TABLE public.notes OWNER TO neondb_owner;

--
-- Name: notes_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notes_id_seq OWNER TO neondb_owner;

--
-- Name: notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.notes_id_seq OWNED BY public.notes.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    regulation_id integer NOT NULL,
    user_id integer NOT NULL,
    type text NOT NULL,
    frequency text NOT NULL,
    enabled boolean DEFAULT true NOT NULL
);


ALTER TABLE public.notifications OWNER TO neondb_owner;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO neondb_owner;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: regulations; Type: TABLE; Schema: public; Owner: neondb_owner
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


ALTER TABLE public.regulations OWNER TO neondb_owner;

--
-- Name: regulations_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.regulations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.regulations_id_seq OWNER TO neondb_owner;

--
-- Name: regulations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.regulations_id_seq OWNED BY public.regulations.id;


--
-- Name: session; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO neondb_owner;

--
-- Name: system_logs; Type: TABLE; Schema: public; Owner: neondb_owner
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


ALTER TABLE public.system_logs OWNER TO neondb_owner;

--
-- Name: system_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.system_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_logs_id_seq OWNER TO neondb_owner;

--
-- Name: system_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.system_logs_id_seq OWNED BY public.system_logs.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
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


ALTER TABLE public.users OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: comments id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.comments ALTER COLUMN id SET DEFAULT nextval('public.comments_id_seq'::regclass);


--
-- Name: deadlines id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.deadlines ALTER COLUMN id SET DEFAULT nextval('public.deadlines_id_seq'::regclass);


--
-- Name: evidence_files id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.evidence_files ALTER COLUMN id SET DEFAULT nextval('public.evidence_files_id_seq'::regclass);


--
-- Name: guides id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.guides ALTER COLUMN id SET DEFAULT nextval('public.guides_id_seq'::regclass);


--
-- Name: notes id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notes ALTER COLUMN id SET DEFAULT nextval('public.notes_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: regulations id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.regulations ALTER COLUMN id SET DEFAULT nextval('public.regulations_id_seq'::regclass);


--
-- Name: system_logs id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.system_logs ALTER COLUMN id SET DEFAULT nextval('public.system_logs_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: deadlines deadlines_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.deadlines
    ADD CONSTRAINT deadlines_pkey PRIMARY KEY (id);


--
-- Name: evidence_files evidence_files_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.evidence_files
    ADD CONSTRAINT evidence_files_pkey PRIMARY KEY (id);


--
-- Name: guides guides_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.guides
    ADD CONSTRAINT guides_pkey PRIMARY KEY (id);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: regulations regulations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.regulations
    ADD CONSTRAINT regulations_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: system_logs system_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.system_logs
    ADD CONSTRAINT system_logs_pkey PRIMARY KEY (id);


--
-- Name: users users_external_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_external_id_key UNIQUE (external_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- Name: idx_regulations_agency; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_regulations_agency ON public.regulations USING btree (agency_name);


--
-- Name: idx_regulations_category; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_regulations_category ON public.regulations USING btree (category);


--
-- Name: idx_regulations_item_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_regulations_item_id ON public.regulations USING btree (item_id);


--
-- Name: idx_regulations_itemid; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_regulations_itemid ON public.regulations USING btree (item_id);


--
-- Name: idx_regulations_jurisdiction; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_regulations_jurisdiction ON public.regulations USING btree (jurisdiction);


--
-- Name: idx_regulations_last_updated; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_regulations_last_updated ON public.regulations USING btree (last_updated);


--
-- Name: idx_regulations_topic; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_regulations_topic ON public.regulations USING btree (topic);


--
-- Name: regulations regulations_previous_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.regulations
    ADD CONSTRAINT regulations_previous_version_id_fkey FOREIGN KEY (previous_version_id) REFERENCES public.regulations(id);


--

--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

-- Users table data
--
-- PostgreSQL database dump
--

-- Dumped from database version 16.8
-- Dumped by pg_dump version 16.5

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

--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.users (id, username, password, role, department, email, "firstName", "lastName", external_id, provider_id, identity_provider, last_login, created_at, updated_at) FROM stdin;
5	nasol@moravian.edu	4f09114c36bfd8bce96204888921752aebb6a4d26842746255d405733ad5305a3bba415fe60523b8ea87425e93bea4275ab4368e298b2cc8d2c0b2f8b736acd1.ec07d9e5935ec88a460022b62913dfde	admin	Compliance		\N	\N	\N	\N	\N	\N	2025-03-04 14:30:48.855809	2025-03-04 14:30:49.04378
7	leahn	89d1677273cf096733b7ebf1debb057e69a60ba4720252296366b37819f23fdc9704c7ce6cd1c1f5b21b76b14a08bfe46d78efa0023fb02a613562f176eeb251.60f43f7f991a731dbf6f60c39f124c38	admin	leahn		\N	\N	\N	\N	\N	\N	2025-03-04 14:30:48.855809	2025-03-04 14:30:49.04378
8	leahnaso	1c9d95a0b94e2aa56b9a1c6d2eadcae930b301cfbeeaedced1d28ddd3fc6c06150041471a3553b9d9b7d2ef310c85598e66c01e5e6b9f9606306b7d2bb701cfd.f59210d79fec350e37e1b36c55eae1e1	admin	Compliance	nasol@moravian.edu	\N	\N	\N	\N	\N	\N	2025-03-04 14:30:48.855809	2025-03-04 14:30:49.04378
10	sharontest	a6c15631205a4bea6a2b1904a179e87b3b6005a83d0109fd2092fc0956efba8acc5924007e7569179c80c44df3202ac1e30d195d5718c4c5703df0d8f4473467.64812ca8a4ad8fd2717452f5bb7feede	user	IR	mauss@moravian.edu	\N	\N	\N	\N	\N	\N	2025-03-04 14:30:48.855809	2025-03-04 14:30:49.04378
13	sharonadmin	1443c0935be1a3a5007a5f918074b309e9e19c06e5ba93f95cd6ffd6f7ecec3c328017ea74cfd0030a231f641cdbb03dc729bd9a80ef3aee7b7158500ef2c09a.bacc51fda3c0591035a37238988e6b37	admin	IR	mauss@moravian.edu	\N	\N	\N	\N	\N	\N	2025-03-04 14:30:48.855809	2025-03-04 14:30:49.04378
14	davehome	6c8ed6f7170d3c540adaf429b13a665a071c11f01094830d394388d1a00405c516f725b58140cb29b9f7e0b6ab7e249d67222809a1f16de1df825c67493ab454.596e555dfa89f8e45c1c05422062c3ed	user	IT	brandesd@gmail.com	\N	\N	\N	\N	\N	\N	2025-03-04 14:30:48.855809	2025-03-04 14:30:49.04378
15	edingerp	4c02bcad5be4acfeebb8b3942888eac4bc3c5ee7605a8b2556f5cd4e94e236ad443e0b0b2626fb60d2151e4fc4c65b0ed911d800fd0875d93ff24c913292ec72.ff3fb2713f66dcd52295433aadcdd6ad	admin	IT	edingerp@moravian.edu	\N	\N	\N	\N	\N	\N	2025-03-04 14:30:48.855809	2025-03-04 14:30:49.04378
16	DMariano44	0a3f9f85a40337c89d8c52072f2a2ff29057324086d51dd19709c9a0668f135eecddd0c46495a798e2bb6b54745f9681d5a00eb3bf340f30183c83aadcbe83a3.93efcdc9d98daf4cc1bdd75c052585ad	user	HR	marianod@moravian.edu	\N	\N	\N	\N	\N	\N	2025-03-04 14:49:15.36756	2025-03-04 14:49:15.36756
12	Jim Beers	e3d2e552c882a896695e4456cb8ce0b79fd4fd818050457c337ad8bd6f2f2ff1b163e2a13c23f53a90253049c169f4b8ad74afa062167376e2a7101af078f76a.66ff9ea9aa8229cf1cf8c669e0b0d841	admin	Information Technology	beersj@moravian.edu	\N	\N	\N	\N	\N	2025-03-14 21:33:41.211	2025-03-04 14:30:48.855809	2025-03-04 14:30:49.04378
11	meyerg	ecc25fa743e1ae817f61139c79d00b9026cf7a45a42ef303e0e37212b73df28cf592f339b82b84f0678b205ea8fc6f0cbbb090d2e55538061ede7b645dd7809d.9723cce57d5a78c6b31f543cd3a96a1b	admin	Community Wellness	meyerg@moravian.edu	\N	\N	\N	\N	\N	2025-03-04 21:28:58.292	2025-03-04 14:30:48.855809	2025-03-04 14:30:49.04378
6	dvdbrnds	783782f8f254ca4880d60753314b2d648ed30795c856c2b011cae841749b77e3a76461bbb333e1af95db563cdd25d4737f7bfd664ee59dbede1cff31e1c00285.609a61a8a0c4d147ee28cf63830ec8bc	admin	IT	brandesd@moravian.edu	David	Brandes	\N	\N	\N	2025-03-24 20:27:34.664	2025-03-04 14:30:48.855809	2025-03-04 14:30:49.04378
17	lilythedog	04a49a673966819b8a508ded8f80c024426911488ce5f60a9dccba8534831f73ada754843199469d69418d6d4c01f3ea13602183013ed7f9a91af68da93fc053.125307e92837a903a9cde80a43cc5c3b	user	dog affaris	lilythedog@moravian.edu	lily	thedog	\N	\N	\N	\N	2025-03-13 14:59:40.961081	2025-03-13 14:59:40.961081
4	davey	557f98f852351b360acc1fb240062eca4dcd4ae48c781b544f16af9934679e1dd0d3c95e8ef2e8ddbe4da681f4b63d4e8d467190c945ba6df9df83453150dc33.234792cff19ffdd124063d215010c06a	user			\N	\N	\N	\N	\N	\N	2025-03-04 14:30:48.855809	2025-03-04 14:30:49.04378
18	test3	78dc27d6c2dc3a603c20a69f272a6318858a42fdfb5252e311ec7846134483331cf474750d7d7175f95d4ab070206ed60a23d89652a1eb59f9db8a0efef5e32d.34288acf1bb7b35cd05fad4d419567b4	admin	IT	test3@gmail.com	dave	test3	\N	\N	\N	\N	2025-03-24 18:18:05.089863	2025-03-24 18:18:05.089863
\.


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.users_id_seq', 18, true);


--
-- PostgreSQL database dump complete
--

-- Notifications table data
-- Regulations table data
                                                                                                                                     ?column?                                                                                                                                     
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 INSERT INTO regulations VALUES (4461, 'REG1982', 'Higher Education Act: Institutional and Financial Assistance Information for Students', 'Academic Programs', '20 U.S.C. 1092');
 INSERT INTO regulations VALUES (4755, 'REG-1741205494332', 'Regulation ID OSHA-2024-001', 'Workplace Safety Standards', 'Referenced under the Occupational Safety and Health Act of 1970');
 INSERT INTO regulations VALUES (4852, 'PA-paDeptEd-1741813212673', 'Untitled Regulation', 'Higher Education', '');
 INSERT INTO regulations VALUES (4850, 'PA-paDeptEd-1741813075521', 'default', 'Higher Education', '');
 INSERT INTO regulations VALUES (4479, 'REG3216', 'Tax Cuts and Jobs Act of 2017 (endowment excise tax)', 'Accounting', '');
 INSERT INTO regulations VALUES (4487, 'REG1800', 'Higher Education Act: Readmission Requirements for Servicemembers', 'Admissions', '20 U.S.C. § 1091c');
 INSERT INTO regulations VALUES (4756, 'REG-1741205499383', 'EDU-2024-001 Regulation', 'Higher Education Financial Assistance', '20 U.S.C. § 1070 et seq.');
 INSERT INTO regulations VALUES (4775, 'REG-1741273099760', 'Family Educational Rights and Privacy Act (FERPA) 2024 Update', 'Education Rights', '20 U.S.C. § 1232g');
 INSERT INTO regulations VALUES (4510, 'REG1981', 'Davis-Bacon Act', 'Contracts & Procurement', '40 U.S.C. §§ 3141- 3144, 3146, 3147');
 INSERT INTO regulations VALUES (4520, 'REG1820', 'Higher Education Act: Institutional and financial assistance information for students', 'Copyright & Trademark', '20 U.S.C. § 1092(a)(1)(P)');
 INSERT INTO regulations VALUES (4532, 'REG1904', 'Equal Employment Opportunity', 'Discrimination', 'Executive Order 11246 (OFCCP)');
 INSERT INTO regulations VALUES (4548, 'REG1831', 'Genetic Information Non-Discrimination Act of 2008', 'Diversity/Affirmative Action', 'Public Law No. 110-233');
 INSERT INTO regulations VALUES (4488, 'REG3221', 'Section 504 of The Rehabilitation Act of 1973', 'Admissions', '29 U.S.C. § 794');
 INSERT INTO regulations VALUES (4489, 'REG1993', 'Title IX of the Education Amendment of 1972', 'Admissions', '20 U.S.C. §§ 1681-1688');
 INSERT INTO regulations VALUES (4764, 'REG-1741272396558', 'Americans with Disabilities Act (ADA) Amendments Act of 2024, Section 001', 'Disability Rights and Accessibility', '42 U.S.C. § 12101 et seq.');
 INSERT INTO regulations VALUES (4490, 'REG1801', 'Title VI of the Civil Rights Act of 1964', 'Admissions', '42 U.S.C. §§ 2000d-2000d-7');
 INSERT INTO regulations VALUES (4829, 'REG-1741278564686', 'Title IX of the Education Amendments of 1972; a Policy Interpretation; Title IX and Intercollegiate Athletics', 'Civil Rights', '45 CFR Part 86');
 INSERT INTO regulations VALUES (4588, 'REG3656', 'OSHA’s  Emergency Action Plan Standard', 'Environmental Health and Safety', '');
 INSERT INTO regulations VALUES (4603, 'REG3639', 'Restrictions on Former Officers, Employees, and Elected Officials of the Executive and Legislative', 'Ethics', '18 U.S.C. § 207');
 INSERT INTO regulations VALUES (4604, 'REG3641', 'Salary of Government Officials and Employees Payable Only by United States', 'Ethics', '18 U.S.C. § 209');
 INSERT INTO regulations VALUES (4609, 'REG1866', 'International Traffic in Arms Regulations (ITAR)', 'Export Controls', '22 U.S.C. § 2778');
 INSERT INTO regulations VALUES (4610, 'REG1867', 'Trading with the Enemy Act of 1917', 'Export Controls', '22 U.S.C. § 7201-7211');
 INSERT INTO regulations VALUES (4633, 'REG1881', 'Student Loan Default Prevention Initiative Act of 1990', 'Financial Aid', '20 U.S.C. §§ 1001-1019d');
 INSERT INTO regulations VALUES (4636, 'REG1883', 'Title IX of the Education Amendment of 1972', 'Financial Aid', '20 U.S.C. §§ 1681-1688');
 INSERT INTO regulations VALUES (4647, 'REG2008', 'Department of Education General Administrative Regulations and Other Applicable Grant Regulations', 'Grants Management', 'Department of Education General Administrative Regulations and Other Applicable Grant Regulations');
 INSERT INTO regulations VALUES (4672, 'REG1940', 'Junk Fax Prevention Act of 2005', 'Information Technology', 'Public Law 109–21');
 INSERT INTO regulations VALUES (4673, 'REG1941', 'No Electronic Theft Act', 'Information Technology', 'No Electronic Theft (NET) Act');
 INSERT INTO regulations VALUES (4674, 'REG2021', 'Telemarketing', 'Information Technology', '47 U.S.C. § 227');
 INSERT INTO regulations VALUES (4707, 'REG1921', 'Federal Volunteer Protection Act', 'Recruitment Hiring & Termination', 'Public Law No. 105-19');
 INSERT INTO regulations VALUES (4708, 'REG1922', 'Immigration and Nationality Act', 'Recruitment Hiring & Termination', '8 U.S.C. §§ 1101-1537');
 INSERT INTO regulations VALUES (4725, 'REG1928', 'Qualified Pensions', 'Retirement', '26 U.S.C. § 401');
 INSERT INTO regulations VALUES (4731, 'REG1959', 'Cafeteria Plans 26 U.S.C. § 125', 'Tax', '');
 INSERT INTO regulations VALUES (4746, 'REG1971', 'Unrelated Business Income (UBIT)', 'Tax', '26 U.S.C. 511(a)(2)');
 INSERT INTO regulations VALUES (4760, 'REG-1741205613258', 'Family Educational Rights and Privacy Act of 2024', 'Student Privacy and Educational Records', '20 U.S.C. § 1232g');
 INSERT INTO regulations VALUES (4470, 'REG1988', 'Fair Credit Reporting Act (FCRA)', 'Accounting', '15 U.S.C. §§ 1681-1681v');
 INSERT INTO regulations VALUES (4486, 'REG1992', 'Higher Education Act: Institutional and Financial Assistance Information for Students', 'Admissions', '20 U.S.C. 1092(k)');
 INSERT INTO regulations VALUES (4506, 'REG1814', 'Anti-Kickback Act of 1986', 'Contracts & Procurement', '41 U.S.C. §§ 8701-8707');
 INSERT INTO regulations VALUES (4514, 'REG3242', 'Small Business Act and Small Business Investment Act of 1958', 'Contracts & Procurement', '15 U.S.C.  631-657s');
 INSERT INTO regulations VALUES (4551, 'REG1832', 'Section 504 of The Rehabilitation Act of 1973', 'Diversity/Affirmative Action', '29 U.S.C. § 701');
 INSERT INTO regulations VALUES (4564, 'REG3646', 'Atomic Energy Act of 1954', 'Environmental Health and Safety', '42 U.S.C. §§ 2011-2296b-7');
 INSERT INTO regulations VALUES (4599, 'REG3635', 'Compensation to Members of Congress, Officers, Others in Matters Affecting the Government', 'Ethics', '18 U.S.C. § 203');
 INSERT INTO regulations VALUES (4611, 'REG1978', 'Contracts with Third Party Servicers', 'Financial Aid', '20 U.S.C. § 1094(c)');
 INSERT INTO regulations VALUES (4616, 'REG1879', 'Higher Education Act: Code of Conduct', 'Financial Aid', '20 U.S.C. § 1094');
 INSERT INTO regulations VALUES (4639, 'REG1974', 'Higher Education Act: Foreign Gift and Contract Reports', 'Fundraising & Development', '20 U.S.C. § 1011f');
 INSERT INTO regulations VALUES (4652, 'REG1895', 'Controlled Substances Act', 'Health Care and Insurance', '21 U.S.C. §§ 801-889');
 INSERT INTO regulations VALUES (4671, 'REG1939', 'Homeland Security Act of 2002', 'Information Technology', '6 U.S.C. §§ 101 – 674');
 INSERT INTO regulations VALUES (4699, 'REG1953', 'Higher Education Act: Credit Hour Definition', 'Program Integrity Rules', '20 U.S.C. §§ 1001, 1002');
 INSERT INTO regulations VALUES (4710, 'REG2036', 'America COMPETES Act', 'Research', 'Public Law No. 111-358');
 INSERT INTO regulations VALUES (4714, 'REG1955', 'Food and Drug Administration (FDA) Amendments Act of 2007', 'Research', 'Public Law No. 110-85');
 INSERT INTO regulations VALUES (4680, 'REG1944', 'Visual Artists Rights Act', 'Intellectual Property and Technology Transfer', '17 U.S.C. § 106A');
(50 rows)

-- Notes table data
                                               ?column?                                               
------------------------------------------------------------------------------------------------------
 INSERT INTO notes VALUES (4, 3869, 6, 'sadfdsa', 'sgagsd');
 INSERT INTO notes VALUES (5, 3869, 6, 'we learned that ageism ia real ', 'LZmf,/na''sdklvnmZ"LKvm');
 INSERT INTO notes VALUES (6, 3869, 6, 'username test', 'dave dave dave');
 INSERT INTO notes VALUES (7, 3869, 6, 'Ffgddgsa', 'SDGagagdsa');
 INSERT INTO notes VALUES (8, 3869, 6, 'agadsgsa', '<p>wqfegfawg</p>');
 INSERT INTO notes VALUES (9, 3869, 6, 'wedfgwaef', '<p>awegawgqaw</p>');
 INSERT INTO notes VALUES (10, 3869, 6, 'qargag', '<p>agqaraegr</p>');
 INSERT INTO notes VALUES (11, 3869, 6, 'argag', '<p>asdfgaerg</p>');
 INSERT INTO notes VALUES (13, 4850, 6, 'tets 3', '<p>test 3</p>');
(9 rows)

