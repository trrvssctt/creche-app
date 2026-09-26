--
-- PostgreSQL database dump
--

\restrict vyJjJUglPpSQH3cNfx5EKOaqeweccU34JUb1Jq01esRcbZ9evnaIrjRERI8yKpf

-- Dumped from database version 16.14
-- Dumped by pg_dump version 18.4

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
-- Name: users; Type: TABLE; Schema: public; Owner: gestionapp
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password text NOT NULL,
    role character varying(30) DEFAULT 'EMPLOYEE'::character varying,
    mfa_enabled boolean DEFAULT false,
    last_login timestamp with time zone,
    active_session boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    roles character varying(255)[] DEFAULT ARRAY['EMPLOYEE'::character varying(255)] NOT NULL,
    employee_id uuid,
    eleve_ids uuid[] DEFAULT '{}'::uuid[],
    signature_url text,
    documents_signes jsonb DEFAULT '[]'::jsonb,
    password_reset_token character varying(255),
    password_reset_expires timestamp with time zone
);


ALTER TABLE public.users OWNER TO gestionapp;

--
-- Name: COLUMN users.eleve_ids; Type: COMMENT; Schema: public; Owner: gestionapp
--

COMMENT ON COLUMN public.users.eleve_ids IS 'Liste des IDs d''élèves dont cet utilisateur est le parent/tuteur. Utilisé exclusivement pour les comptes avec rôle PARENT ou TUTEUR.';


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: gestionapp
--

COPY public.users (id, tenant_id, name, email, password, role, mfa_enabled, last_login, active_session, is_active, created_at, updated_at, roles, employee_id, eleve_ids, signature_url, documents_signes, password_reset_token, password_reset_expires) FROM stdin;
06d97cc8-301b-4e9a-9ed4-dda1802523eb	700ad2e9-920f-44a9-a61d-e0c94ee0da7a	Omar DIALLO	omar.diallo@gmail.com	$2b$10$vD1A73sQE9.e4x5KSQrgZ.TmrfgkwRX.V2QoXI7m7PLsweD37dbwO	ADMIN	f	2026-04-24 11:22:30.562+00	t	t	2026-04-15 23:27:05.585+00	2026-04-24 11:22:30.562+00	{ADMIN}	\N	{}	\N	[]	\N	\N
6ed0a4cb-a525-4045-a904-d285da6c6543	72a7587a-86cb-4c9a-9084-5dcf11f54131	Salif DIANKA	salut@gmail.com	$2b$10$vD1A73sQE9.e4x5KSQrgZ.TmrfgkwRX.V2QoXI7m7PLsweD37dbwO	ADMIN	f	2026-04-16 07:58:07.021+00	t	t	2026-04-15 10:35:35.075+00	2026-04-16 07:58:07.021+00	{ADMIN}	\N	{}	\N	[]	\N	\N
03ab05c5-96a3-4df5-80c3-2fbfecc2bf2c	d311c079-be9e-4800-a5e3-8d58021c18c6	Maitre Testeur	trial.test.random@realtechprint.com	$2b$10$vD1A73sQE9.e4x5KSQrgZ.TmrfgkwRX.V2QoXI7m7PLsweD37dbwO	ADMIN	f	\N	f	t	2026-04-20 10:15:20.259+00	2026-04-20 10:15:20.259+00	{ADMIN}	\N	{}	\N	[]	\N	\N
b41e17a0-ba8a-485b-9965-9cff6f7d46eb	72e8096b-ea58-49e6-a03d-a9d36b982157	Ali SALL	ali.sall@alibaba.com	$2b$10$vD1A73sQE9.e4x5KSQrgZ.TmrfgkwRX.V2QoXI7m7PLsweD37dbwO	ADMIN	f	2026-04-30 18:07:06.146+00	t	t	2026-04-07 11:10:24.935+00	2026-04-30 18:07:06.146+00	{ADMIN}	\N	{}	\N	[]	\N	\N
f4aaf0dc-02fe-4039-a43e-2ddbad5113be	b2688399-60a9-42ad-ac8c-d16b0fffdf4c	Ibrahima Diallo	comptable@toit-des-anges.sn	$2b$10$vD1A73sQE9.e4x5KSQrgZ.TmrfgkwRX.V2QoXI7m7PLsweD37dbwO	COMPTABLE	f	2026-05-02 09:46:04.105+00	t	t	2026-05-02 09:07:55.633649+00	2026-05-02 09:46:04.106+00	{COMPTABLE}	\N	{}	\N	[]	\N	\N
814f4b80-4d6d-4ee7-8095-1321014036ad	b2688399-60a9-42ad-ac8c-d16b0fffdf4c	ss ss	ss@gmail.com	$2b$10$0V1BP2OrjbCVlgKHB/r9l.ORurDJl1bDeGTGCYSplY.hoIDNeH7oS	PARENT	f	2026-06-29 17:39:19.012+00	t	t	2026-06-29 17:38:39.439+00	2026-06-29 17:39:19.012+00	{PARENT}	\N	{2aa457ba-475d-4b2f-b930-33e30befed08}	\N	[]	\N	\N
a8f132fa-337d-471a-bab3-21481111f714	b2688399-60a9-42ad-ac8c-d16b0fffdf4c	Anta PELTRE	robertseye@hotmail.fr	$2b$10$tJzY3pUX4WmEaWc7avX98.aNKB.YxF2LNYuTOXFt04l65VOst/cUS	PARENT	f	2026-06-25 12:34:26.077+00	t	t	2026-06-25 12:33:00.959+00	2026-06-25 12:34:26.078+00	{PARENT}	\N	{1f7d77bc-1b85-41b6-81a4-15e702e137eb}	\N	[]	\N	\N
9b4f09ee-3371-4a88-975b-3cdc5ef114f9	b2688399-60a9-42ad-ac8c-d16b0fffdf4c	Anta PELTRE	robertseyet@hotmail.fr	$2b$10$GKwjYszzWJeyRBYHBrF0Huxci5xWi6M77FQ9K8SBRedXYsvFRx3X2	PARENT	f	2026-06-28 17:42:08.653+00	t	t	2026-06-28 17:26:47.851+00	2026-06-28 17:42:08.654+00	{PARENT}	\N	{1f7d77bc-1b85-41b6-81a4-15e702e137eb}	\N	[]	\N	\N
98b1ef55-97e7-4c51-82e7-5995c7ce3c46	b2688399-60a9-42ad-ac8c-d16b0fffdf4c	david peltre	antapeltre@gmail.com	$2b$10$swgXFIHfIy.rAYo34FzH0eYSEZTPXBqVJxJLzFPVo0iPpmnDAwhoO	PARENT	f	2026-07-09 13:08:33.85+00	t	t	2026-07-09 13:08:12.099+00	2026-07-09 13:08:33.851+00	{PARENT}	\N	{433a2120-fe1d-471a-a6b0-28266e9ae3f1}	\N	[]	\N	\N
50c5dc1e-aacc-4e0a-8be5-867dd38160e3	b2688399-60a9-42ad-ac8c-d16b0fffdf4c	Pape Malick CISSÉ	malick.cisse@gmail.com	$2b$10$Hly4KrqOQe3067x0wdlXyOOvALc4FX6x8iw/mKdxRPdSTY0L7pAfi	PARENT	f	2026-06-22 23:50:04.814+00	t	t	2026-06-22 23:49:31.378+00	2026-06-22 23:50:04.814+00	{PARENT}	\N	{67476177-7ea1-40fb-94e6-78d5121ccb33}	\N	[]	\N	\N
2c22e5cd-de2c-4595-8aa3-3f45df6fedf1	b2688399-60a9-42ad-ac8c-d16b0fffdf4c	Ndeye Astou DIALLO	n2adcompany@gmail.com	$2b$10$VZBwgafpNCcxRrWEK5t/r.HrrSSiY6ISK8q40ZU4QYPEKShpYBePy	PARENT	f	2026-07-16 12:12:15.937+00	t	t	2026-07-04 17:33:54.42+00	2026-07-16 12:12:15.937+00	{PARENT}	\N	{821ca58e-6017-43a9-8570-93c79ea60a7d}	\N	[]	\N	\N
7ce52a2e-16f0-4659-b647-cb25bd9b6aa1	b2688399-60a9-42ad-ac8c-d16b0fffdf4c	Rougi Soumaré	rougi.soumaré@gmail.com	$2b$10$94U4g9iN6shf5KnKXAbzbeH0GsWGB7MMLw/mpwNp0QK/s.fuAMJ1u	PARENT	f	2026-07-20 10:27:26.767+00	t	t	2026-07-20 10:06:59.976+00	2026-07-20 10:27:26.768+00	{PARENT}	\N	{151a6144-191d-4f63-84a3-871d613c887e}	\N	[]	\N	\N
6fa46317-6c58-4c06-90a7-85c33f2295ac	b2688399-60a9-42ad-ac8c-d16b0fffdf4c	Salif DIANKA	diankaseydou52@gmail.com	$2b$10$CQLNjjGnsaRTcvl1ex0jReTKyZGog1n61DW7INORHTmbJgba3ZfT2	PARENT	f	2026-08-01 14:35:11.264+00	t	t	2026-07-21 20:30:08.791+00	2026-08-01 14:35:11.265+00	{PARENT}	\N	{944bb95f-8174-4cbf-9e6c-896c08b350b1}	https://res.cloudinary.com/dq7avew9h/image/upload/v1785191421/undefined/uploads/1785191420749_signatures_parent_6fa46317-6c58-4c06-90a7-85c33f2295ac.png	[{"date": "2026-07-23T09:29:00.784Z", "eleveId": "96fe57a9-ca99-4698-8c06-45a6ed68b156", "typeDoc": "autorisation_sortie"}, {"date": "2026-07-23T09:29:18.583Z", "eleveId": "96fe57a9-ca99-4698-8c06-45a6ed68b156", "typeDoc": "fiche_inscription"}, {"date": "2026-07-27T22:31:07.610Z", "eleveId": "96fe57a9-ca99-4698-8c06-45a6ed68b156", "typeDoc": "convention_scolarisation"}]	\N	\N
0feaa726-1466-4538-a3d3-15da2956e815	b2688399-60a9-42ad-ac8c-d16b0fffdf4c	Juiliana anne cecile Varela	jvarela@act-afrique.com	$2b$10$1eykNqi9JO9AuTbRoq2cre4w79ahJ5l4xoCVY4Xm1tjCWh8i3LwiS	PARENT	f	2026-07-20 10:02:14.436+00	t	t	2026-07-16 13:14:53.691+00	2026-07-20 10:02:14.436+00	{PARENT}	\N	{50b880ff-8de2-41fa-bdb5-3d163ee6484c}	https://res.cloudinary.com/dq7avew9h/image/upload/v1784487154/undefined/uploads/1784487154582_signatures_parent_0feaa726-1466-4538-a3d3-15da2956e815.png	[{"date": "2026-07-19T18:50:16.991Z", "eleveId": "50b880ff-8de2-41fa-bdb5-3d163ee6484c", "typeDoc": "fiche_inscription"}, {"date": "2026-07-19T18:52:58.457Z", "eleveId": "50b880ff-8de2-41fa-bdb5-3d163ee6484c", "typeDoc": "convention_scolarite"}, {"date": "2026-07-19T18:53:22.955Z", "eleveId": "50b880ff-8de2-41fa-bdb5-3d163ee6484c", "typeDoc": "autorisation_sortie"}, {"date": "2026-07-19T21:03:08.666Z", "eleveId": "50b880ff-8de2-41fa-bdb5-3d163ee6484c", "typeDoc": "convention_scolarisation"}, {"date": "2026-07-19T21:17:28.930Z", "eleveId": "50b880ff-8de2-41fa-bdb5-3d163ee6484c", "typeDoc": "fiche_sanitaire"}]	\N	\N
02fa59bb-c37a-4d70-a764-6dc0771afd82	b2688399-60a9-42ad-ac8c-d16b0fffdf4c	Maïmouna KEITA 	maimounakeita14@gmail.com	$2b$10$3c4mg6JdYvsd8p5RYowIyeXRrHWKwXRx4uJfP3H8wDBN8TC9zNb32	PARENT	f	\N	f	t	2026-07-20 10:21:40.161+00	2026-07-20 10:21:40.161+00	{PARENT}	\N	{41af2f20-302d-4054-95b0-dbf074c95bdf}	\N	[]	\N	\N
e3b31b99-2552-4aea-b8cb-c618215f8edc	b2688399-60a9-42ad-ac8c-d16b0fffdf4c	Omar  CAMARA 	dinatall76@gmail.com	$2b$10$0B/C7HgvAjGnoNDqOVi/k.g/DJYQjqaHVPOyVQ1FGz7NgBzntSnAC	PARENT	f	\N	f	t	2026-07-23 16:16:55.321+00	2026-07-23 16:16:55.321+00	{PARENT}	\N	{af5cb81c-e5f5-403c-94b5-2ec7ca133560}	\N	[]	\N	\N
9646dbb6-4747-4042-a22c-31d1d1931221	b2688399-60a9-42ad-ac8c-d16b0fffdf4c	Assitan  DIARRA 	assitan06@outlook.com	$2b$10$Sd1h9N1kn78NEVWMbZG.Muub0qwaundHvr1qxu94P0t0/wBXXG/KW	PARENT	f	\N	f	t	2026-07-30 14:20:54.239+00	2026-07-30 14:20:54.239+00	{PARENT}	\N	{e5b9c15f-86c3-4240-896d-d8b08624048c}	\N	[]	\N	\N
0c2d6a8c-0176-4cc4-a202-3b495d58dcde	b2688399-60a9-42ad-ac8c-d16b0fffdf4c	Ndeye Aby Dieye	madieye1986@gmail.com	$2b$10$X6MKleiYorfyWvNbUadzQOdqIaMrf9MTLCWRoPMAPDMjPnDBKAM1i	PARENT	f	\N	f	t	2026-07-30 14:35:07.54+00	2026-07-30 14:35:07.54+00	{PARENT}	\N	{03356f4b-7f51-43f9-b472-a732b4f31f8f}	\N	[]	\N	\N
19149f42-a1f9-45a8-99fd-4c4dceed997c	b2688399-60a9-42ad-ac8c-d16b0fffdf4c	COSSI Hermann  CAPKO 	capkocossihermann@gmail.com	$2b$10$KckClUyw4PcV.cSpFrRgWu/W321fvR73480F5qMkrqu1JGv4ekM56	PARENT	f	\N	f	t	2026-07-30 14:40:01.926+00	2026-07-30 14:40:01.926+00	{PARENT}	\N	{a027c6f0-b5b0-4e3a-9d6e-8029287593ee}	\N	[]	\N	\N
69e9344a-b095-4f8e-943b-ad0813c675fe	b2688399-60a9-42ad-ac8c-d16b0fffdf4c	Mansour DIOP	mansour.diop@mail.com	$2b$10$LfSxYrwBBjSz/.HQKLWsnuGBDNXHkDBT/SfPwbfcFzgwdv/innHcK	PARENT	f	2026-07-30 17:11:32.74+00	t	t	2026-06-21 13:00:15.059+00	2026-07-31 14:57:13.738+00	{PARENT}	\N	{b062f10e-34c9-4cd5-be1f-5be21ef8bf94}	https://res.cloudinary.com/dq7avew9h/image/upload/v1785509833/undefined/uploads/1785509832721_signatures_parent_69e9344a-b095-4f8e-943b-ad0813c675fe.png	[{"date": "2026-07-23T11:59:52.822Z", "eleveId": "56c86bb6-4e88-454b-ab2b-9d5707f30b77", "typeDoc": "fiche_inscription"}, {"date": "2026-07-21T13:20:21.921Z", "eleveId": "56c86bb6-4e88-454b-ab2b-9d5707f30b77", "typeDoc": "convention_scolarisation"}, {"date": "2026-07-23T11:59:27.077Z", "eleveId": "56c86bb6-4e88-454b-ab2b-9d5707f30b77", "typeDoc": "autorisation_sortie"}, {"date": "2026-07-23T12:00:42.145Z", "eleveId": "56c86bb6-4e88-454b-ab2b-9d5707f30b77", "typeDoc": "autorisation_soins"}]	\N	\N
0742eb47-44ec-4d1f-b216-96a4cd3b7824	b2688399-60a9-42ad-ac8c-d16b0fffdf4c	Directrice	directrice@toit-des-anges.sn	$2b$12$l9wCSwZJ/FLflzH.CEfoSOokQYyvs0ZtSl4UYgT1qGaExPZozTgYq	ADMIN	f	2026-08-01 14:44:05.464+00	t	t	2026-08-01 14:38:28.072004+00	2026-08-01 14:44:05.464+00	{ADMIN,DIRECTEUR}	\N	{}	\N	[]	\N	\N
\.


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: gestionapp
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_tenant_id_email_key; Type: CONSTRAINT; Schema: public; Owner: gestionapp
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_email_key UNIQUE (tenant_id, email);


--
-- Name: idx_users_email_unique; Type: INDEX; Schema: public; Owner: gestionapp
--

CREATE UNIQUE INDEX idx_users_email_unique ON public.users USING btree (lower((email)::text));


--
-- Name: idx_users_tenant; Type: INDEX; Schema: public; Owner: gestionapp
--

CREATE INDEX idx_users_tenant ON public.users USING btree (tenant_id);


--
-- Name: users users_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gestionapp
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gestionapp
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict vyJjJUglPpSQH3cNfx5EKOaqeweccU34JUb1Jq01esRcbZ9evnaIrjRERI8yKpf

