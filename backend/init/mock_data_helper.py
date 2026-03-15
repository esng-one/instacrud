# mock_data_helper.py
"""
Helper module for populating organizational mock data.
This can be used by init_mock_db.py for testing and by the signup API
to optionally load sample data for new organizations.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Tuple, Optional, Dict

from instacrud.api.organization_api import SEARCH_MODELS
from instacrud.model.organization_model import (
    Client, ClientType, Project, ProjectDocument,
    Contact, Address
)
from instacrud.database import ensure_search_indexes_for_org, firestore_mode, init_org_db


# -------------------------------------------------------------------
# Sample Clients Data (12 clients — matches init_mock_db per-org count)
# -------------------------------------------------------------------
SAMPLE_CLIENTS = [
    (
        "harbor_construction",
        ClientType.COMPANY,
        "Harbor Construction Co.",
        [("John Miller", "Project Manager", "john.miller@harborco.com", "+1-212-555-0142")],
        [("101 Pier Ave", None, "Boston", "MA", "02110", "USA")]
    ),
    (
        "greenleaf_designs",
        ClientType.COMPANY,
        "Greenleaf Interior Designs",
        [("Sophie Alvarez", "Creative Director", "sophie@greenleafdesigns.com", "+1-212-555-0198")],
        [("77 Green St", "Suite 300", "New York", "NY", "10012", "USA")]
    ),
    (
        "samantha_chen",
        ClientType.PERSON,
        "Samantha Chen (Private Client)",
        [("Samantha Chen", "Collector", "samantha.chen@email.com", "+1-917-555-0220")],
        [("245 Park Lane", None, "Brooklyn", "NY", "11201", "USA")]
    ),
    (
        "brightwave_media",
        ClientType.COMPANY,
        "Brightwave Media LLC",
        [("Brian Lee", "Operations Lead", "brian.lee@brightwavemedia.com", "+1-646-555-0331")],
        [("350 Madison Ave", "Floor 12", "New York", "NY", "10017", "USA")]
    ),
    (
        "ironwood_builders",
        ClientType.COMPANY,
        "Ironwood Builders Inc.",
        [("Thomas Greene", "Construction Supervisor", "tgreene@ironwood.com", "+1-617-555-0201")],
        [("812 Beacon St", None, "Cambridge", "MA", "02139", "USA")]
    ),
    (
        "artistry_design_co",
        ClientType.COMPANY,
        "Artistry Design Co.",
        [("Maya Patel", "Creative Lead", "maya@artistrydesign.co", "+1-212-555-0264")],
        [("505 Design Row", "Studio 14", "Brooklyn", "NY", "11211", "USA")]
    ),
    (
        "cambridge_collectors",
        ClientType.PERSON,
        "Dr. Allen Reese (Private Collector)",
        [("Allen Reese", "Scientist", "areese@collector.com", "+1-781-555-0344")],
        [("44 Observatory Rd", None, "Cambridge", "MA", "02138", "USA")]
    ),
    (
        "northbridge_innovations",
        ClientType.COMPANY,
        "Northbridge Innovations",
        [("Elena Park", "Innovation Strategist", "elena.park@northbridge.io", "+1-617-555-0451")],
        [("89 Tech Square", "Floor 3", "Boston", "MA", "02142", "USA")]
    ),
    (
        "beacon_realty_group",
        ClientType.COMPANY,
        "Beacon Realty Group",
        [("Patricia Owens", "Managing Partner", "patricia@beaconrealty.com", "+1-617-555-0231")],
        [("200 Commonwealth Ave", None, "Boston", "MA", "02116", "USA")]
    ),
    (
        "atlantic_marine",
        ClientType.COMPANY,
        "Atlantic Marine Services",
        [("Ralph Stone", "Fleet Manager", "ralph.stone@atlanticmarine.com", "+1-617-555-0284")],
        [("88 Harbor Rd", "Dock 5", "Quincy", "MA", "02169", "USA")]
    ),
    (
        "veridian_labs",
        ClientType.COMPANY,
        "Veridian Labs",
        [("Aisha Grant", "Lead Chemist", "a.grant@veridianlabs.com", "+1-781-555-0199")],
        [("15 Science Park", "Lab B", "Worcester", "MA", "01609", "USA")]
    ),
    (
        "commonthread_collective",
        ClientType.COMPANY,
        "CommonThread Collective",
        [("Luis Romero", "Co-Founder", "luis@commonthread.co", "+1-857-555-0312")],
        [("401 Artisan Way", None, "Somerville", "MA", "02145", "USA")]
    ),
]

# -------------------------------------------------------------------
# Sample Projects Data (11 projects — matches init_mock_db per-org count)
# -------------------------------------------------------------------
SAMPLE_PROJECTS = [
    ("P001", "Waterfront Renovation", "Renovation of the East Harbor waterfront area."),
    ("P002", "Corporate Office Redesign", "Modern redesign for Greenleaf HQ offices."),
    ("P003", "Personal Art Studio", "Custom art studio for Samantha Chen."),
    ("P004", "Tech Lab Renovation", "Renovation of a biotech lab in Kendall Square."),
    ("P005", "Art Exhibition Setup", "Installations for gallery presentation by Artistry Design Co."),
    ("P006", "Smart Home Retrofit", "Full automation upgrade for Dr. Allen Reese's residence."),
    ("P007", "Product Innovation Sprint", "Workshop and prototyping for Northbridge Innovations."),
    ("P008", "Downtown Condo Conversion", "Transforming historic building into upscale condos."),
    ("P009", "Fleet Maintenance Overhaul", "Dock and service improvements for Atlantic Marine."),
    ("P010", "Green Chemistry Initiative", "Sustainable materials research and pilot facilities."),
    ("P011", "E-commerce Studio Buildout", "Production space for CommonThread's digital campaigns."),
]

# -------------------------------------------------------------------
# Sample Documents Data (10 docs — matches init_mock_db per-org count)
# -------------------------------------------------------------------
SAMPLE_DOC_CONTENT = [
    {
        "title": "Smart Building IoT Implementation",
        "content": "This comprehensive proposal outlines the integration of Internet of Things (IoT) sensors and smart devices across our Chicago headquarters facility. The project encompasses installing temperature monitors, occupancy sensors, and automated lighting systems throughout the 15-story building. Our team will deploy over 500 wireless sensors connected via mesh network topology, enabling real-time monitoring and predictive maintenance. The implementation phase will occur in three stages over six months, starting with floors 1-5, then 6-10, and finally 11-15. Expected energy savings are projected at 35% annually, with a return on investment within 24 months. The system will integrate with our existing building management software and provide mobile dashboard access for facilities managers."
    },
    {
        "title": "San Francisco Office Lease Agreement",
        "content": "This legally binding commercial lease agreement is entered into between Pacific Properties LLC (Landlord) and TechVenture Inc (Tenant) for office space located at 450 Mission Street, San Francisco, California. The premises consist of 12,000 square feet on the 8th floor with panoramic bay views. The lease term is five years commencing January 1st, with monthly rent of $72,000 plus utilities. Tenant improvements include installation of glass-walled conference rooms, upgraded HVAC system, and fiber optic internet infrastructure. The landlord agrees to provide 24/7 building access, security services, and parking for 25 vehicles in the underground garage. Standard maintenance and janitorial services are included, with additional amenities such as fitness center and rooftop terrace access."
    },
    {
        "title": "Mobile App Development Progress Report Q3",
        "content": "Our development team has successfully completed 78% of the planned features for the new mobile banking application during Q3. The iOS and Android versions are progressing in parallel using React Native framework, allowing for efficient code sharing. Key accomplishments include implementing biometric authentication (fingerprint and facial recognition), real-time transaction notifications via push messaging, and integration with Apple Pay and Google Pay. User interface testing in Seattle and Portland focus groups received positive feedback, with an average satisfaction score of 4.2 out of 5. Current challenges include optimizing battery consumption during background sync operations and ensuring compliance with latest PCI-DSS security standards. Next quarter priorities are implementing peer-to-peer payment functionality, bill splitting features, and comprehensive accessibility support for visually impaired users."
    },
    {
        "title": "Electric Vehicle Fleet Transition Strategy",
        "content": "This strategic document presents our roadmap for transitioning our entire corporate vehicle fleet to electric vehicles (EVs) across operations in Los Angeles, Phoenix, and Las Vegas by 2027. Currently, we operate 250 delivery vans and service vehicles powered by diesel and gasoline. The phased approach will replace 50 vehicles annually over five years, beginning with shorter-route vehicles in urban areas. Infrastructure requirements include installing 75 Level 2 charging stations at our three regional distribution centers and 15 DC fast charging stations for emergency use. Total project investment is estimated at $18.5 million, including vehicles, charging infrastructure, and electrical upgrades. Projected annual savings include $2.1 million in fuel costs and $800,000 in maintenance expenses. Environmental impact analysis shows reduction of 1,200 metric tons of CO2 emissions annually. Partnership discussions are underway with local utility companies for demand response programs and off-peak charging incentives."
    },
    {
        "title": "Cybersecurity Incident Response Final Report",
        "content": "This report documents the security incident that occurred on March 15th affecting our Houston data center and the comprehensive response measures implemented. At 2:47 AM, our intrusion detection system identified suspicious network traffic patterns indicating potential ransomware activity. The security operations center immediately isolated affected servers, preventing spread to critical production systems. Forensic analysis revealed the attack vector was a phishing email that compromised one employee workstation. No customer data was exfiltrated, and all encrypted files were restored from backup systems within 8 hours. Total downtime for non-critical systems was 6.5 hours. Remediation actions included forced password resets for all 450 employees, deployment of advanced endpoint detection software, enhanced email filtering rules, and mandatory security awareness training. The estimated financial impact was $125,000 in recovery costs and lost productivity. External security audit confirmed no ongoing vulnerabilities, and all systems passed penetration testing. Recommendations for future prevention include implementing multi-factor authentication across all systems, upgrading firewall firmware, and establishing quarterly tabletop exercises for incident response team."
    },
    {
        "title": "Customer Satisfaction Survey Analysis 2025",
        "content": "Our annual customer satisfaction survey conducted across all markets in New York, Boston, Miami, and Atlanta achieved a record response rate of 34% with 8,500 completed questionnaires. Overall satisfaction score improved to 87%, up from 82% in 2024. Key positive drivers included product quality (92% satisfaction), delivery speed (89%), and customer service responsiveness (85%). Areas requiring improvement are mobile app usability (71%), pricing transparency (74%), and return process simplicity (76%). Demographic analysis shows millennial customers (ages 25-40) prefer digital communication channels and self-service options, while older demographics value personal phone support. Net Promoter Score increased to 42, indicating strong customer loyalty and high likelihood of recommendations. Verbatim comments highlighted appreciation for recent chatbot implementation that reduced average response time from 4 hours to 15 minutes. Competitive benchmarking shows our performance exceeds industry average by 12 percentage points. Recommended actions include redesigning mobile checkout flow, implementing transparent pricing calculator, and creating video tutorials for product assembly and troubleshooting."
    },
    {
        "title": "Data Center Migration Project Plan",
        "content": "This project plan details the migration of all IT infrastructure from our aging facility in Dallas to a modern colocation data center in Austin, Texas. The migration encompasses 200 physical servers, 1,500 virtual machines, 2.5 petabytes of storage, and network equipment serving 3,000 users across North America. Project timeline spans 8 months with phased approach to minimize service disruption. Phase one involves replicating production databases and establishing redundant network connectivity. Phase two migrates non-critical applications and conducts extensive testing. Phase three executes cutover of mission-critical ERP, CRM, and financial systems during planned maintenance windows. Risk mitigation strategies include maintaining parallel operations for 30 days, comprehensive rollback procedures, and 24/7 support coverage during transition periods. The new facility offers enhanced capabilities including N+1 power redundancy, advanced fire suppression systems, 100 Gbps internet connectivity, and SOC 2 Type II compliance. Total project budget is $4.2 million with anticipated annual savings of $850,000 through improved energy efficiency and reduced maintenance costs."
    },
    {
        "title": "Pharmaceutical Clinical Trial Results Summary",
        "content": "This document summarizes Phase III clinical trial results for investigational drug XR-2847 treating chronic migraine headaches, conducted across 45 medical centers in Denver, Minneapolis, Cleveland, and Nashville. The randomized, double-blind, placebo-controlled study enrolled 1,250 patients over 18 months. Primary endpoint was reduction in monthly migraine days from baseline to week 24. Results demonstrated statistically significant efficacy with treatment group experiencing average reduction of 7.2 migraine days per month compared to 3.1 days in placebo group (p<0.001). Secondary endpoints including migraine severity, quality of life measures, and acute medication usage all showed favorable outcomes. Safety profile was acceptable with most common adverse events being mild nausea (12% of patients), dizziness (8%), and fatigue (6%). Serious adverse events occurred in 2.1% of treatment group versus 1.8% of placebo group, with no concerning patterns identified. Subgroup analysis indicated particularly strong response in patients with migraine with aura. These results support regulatory submission for FDA approval anticipated in Q2 2026. Long-term extension study will continue monitoring 800 patients for additional 12 months to assess durability of response and evaluate long-term safety."
    },
    {
        "title": "Renewable Energy Investment Proposal",
        "content": "This investment proposal presents an opportunity to acquire and develop a 150-megawatt wind farm project in rural Montana, strategically positioned to serve growing energy demands in Seattle, Portland, and Boise markets. The site features consistent wind resources with average speeds of 8.5 meters per second, ideal for modern turbine technology. Project scope includes installing 50 state-of-the-art wind turbines, constructing access roads, building electrical substation infrastructure, and establishing 20-year power purchase agreements with regional utilities. Total capital requirement is $285 million with projected internal rate of return of 11.2% over 25-year asset life. Construction period is estimated at 18 months, with commercial operation date targeted for Q4 2027. Environmental impact assessments have been completed showing minimal effects on local wildlife with appropriate mitigation measures. Community benefits include $12 million in tax revenue over project lifetime, creation of 200 construction jobs, and 15 permanent operations positions. Financing structure combines 60% project finance debt at favorable rates due to investment tax credit eligibility, with remaining 40% equity from institutional investors. Sensitivity analysis demonstrates project viability across various electricity price scenarios and capacity factor assumptions."
    },
    {
        "title": "Corporate Restructuring Communication Plan",
        "content": "This comprehensive communication plan addresses the organizational restructuring affecting 2,500 employees across offices in Philadelphia, Detroit, Charlotte, and Indianapolis. The restructuring consolidates seven business units into four strategic divisions to improve operational efficiency and reduce overhead costs by 18%. Timeline begins with executive leadership announcement in week one, followed by department-level town halls in week two, individual impact notifications in week three, and transition completion by end of quarter. Communication channels include CEO video message, detailed FAQ documents, dedicated intranet portal, manager training sessions, and weekly email updates. Messaging framework emphasizes strategic rationale, commitment to affected employees, available support resources, and future growth opportunities. Human resources will provide comprehensive support including career counseling, resume workshops, extended health benefits, and generous severance packages for 180 affected positions. Change management team will conduct pulse surveys at 30, 60, and 90 days to monitor employee sentiment and address concerns proactively. Success metrics include employee retention of key talent (target 95%), maintenance of customer satisfaction scores, and achievement of productivity targets during transition. Leadership coaching will be provided to all managers to help navigate difficult conversations and maintain team morale throughout the restructuring process."
    }
]


async def populate_org_data(
    org_id: str,
    client_data: List[Tuple],
    project_data: List[Tuple[str, str, str]],
    doc_content: List[Dict[str, str]],
    embeddings_by_title: Optional[Dict[str, List[float]]] = None,
    create_indexes: bool = True,
    mongo_url: Optional[str] = None,
) -> dict:
    """
    Populate an organization's database with provided data.

    Args:
        org_id: The organization ID (string form of ObjectId)
        client_data: List of client tuples (code, type, name, contacts, addresses)
        project_data: List of project tuples (code, name, description)
        doc_content: List of document dicts with 'title' and 'content' keys
        embeddings_by_title: Optional dict mapping title to embedding vector
        create_indexes: Whether to create search indexes (default True)
        mongo_url: Optional MongoDB URL for Firestore mode

    Returns:
        A dict with counts of created entities
    """
    # Initialize org database context
    await init_org_db(org_id, mongo_url=mongo_url)

    # Create Clients with contacts + addresses
    clients = []
    contacts_created = 0
    addresses_created = 0

    for code, ctype, cname, contacts, addresses in client_data:
        contact_ids = []
        address_ids = []

        for contact_name, title, email, phone in contacts:
            c = Contact(name=contact_name, title=title, email=email, phone=phone)
            await c.insert()
            contact_ids.append(c.id)
            contacts_created += 1

        for street, street2, city, state, zipc, country in addresses:
            a = Address(
                street=street,
                street2=street2,
                city=city,
                state=state,
                zip_code=zipc,
                country=country,
            )
            await a.insert()
            address_ids.append(a.id)
            addresses_created += 1

        client = Client(
            code=code,
            name=cname,
            type=ctype,
            contact_ids=contact_ids,
            address_ids=address_ids,
            description=cname,
        )
        await client.insert()
        clients.append(client)

    # Create Projects
    projects = []
    for code, pname, desc in project_data:
        project = Project(
            code=code,
            client_id=clients[0].id if clients else None,
            name=pname,
            start_date=datetime.now(tz=timezone.utc),
            description=desc,
        )
        await project.insert()
        projects.append(project)

    # Create Documents
    documents_created = 0
    for idx, proj in enumerate(projects):
        if idx < len(doc_content):
            doc_data = doc_content[idx]
            title = doc_data['title']
            embedding = []
            if embeddings_by_title:
                embedding = embeddings_by_title.get(title, [])

            doc = ProjectDocument(
                project_id=proj.id,
                code=f"{proj.code}_{title.replace(' ', '_').upper()}",
                name=f"{proj.name} - {title}",
                content=doc_data['content'],
                description=f"{title} for {proj.name}",
                content_embedding=embedding
            )
            await doc.insert()
            documents_created += 1

    # Ensure search indexes if requested
    if create_indexes and not firestore_mode:
        try:
            await ensure_search_indexes_for_org(org_id, SEARCH_MODELS)
        except Exception as e:
            print(f"WARNING: Failed to create search indexes for org {org_id}: {e}")

    return {
        "clients": len(clients),
        "projects": len(projects),
        "documents": documents_created,
        "contacts": contacts_created,
        "addresses": addresses_created,
    }


async def populate_org_mock_data(org_id: str, create_indexes: bool = True, mongo_url: Optional[str] = None) -> dict:
    """
    Populate an organization's database with default sample mock data.
    This is a convenience function for new user signup flow.

    Args:
        org_id: The organization ID (string form of ObjectId)
        create_indexes: Whether to create search indexes (default True)
        mongo_url: Optional MongoDB URL for Firestore mode

    Returns:
        A dict with counts of created entities
    """
    # Load embeddings so documents get the same vector data as init_mock_db
    embeddings_by_title: Optional[Dict[str, List[float]]] = None
    embeddings_file = Path(__file__).parent / "embeddings_output.json"
    if embeddings_file.exists():
        with open(embeddings_file, "r") as f:
            embeddings_data = json.load(f)
        embeddings_by_title = {item["title"]: item["embedding"] for item in embeddings_data}

    return await populate_org_data(
        org_id=org_id,
        client_data=SAMPLE_CLIENTS,
        project_data=SAMPLE_PROJECTS,
        doc_content=SAMPLE_DOC_CONTENT,
        embeddings_by_title=embeddings_by_title,
        create_indexes=create_indexes,
        mongo_url=mongo_url,
    )
