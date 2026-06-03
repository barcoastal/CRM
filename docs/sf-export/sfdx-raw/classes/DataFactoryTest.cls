@isTest
public without sharing class DataFactoryTest {

    public static Payment_Processor__c createPaymentProcessor() {
        return new Payment_Processor__c(
            Processor_Type__c = 'SAS', Monthly_Bank_Fee__c = 15, Bank_Setup_Fee__c = 10
        );
    }

    public static Payment_Processor__c createPaymentProcessor(String name, String processorType) {
        return new Payment_Processor__c(
            Name = name, Processor_Type__c = processorType, Monthly_Bank_Fee__c = 15, Bank_Setup_Fee__c = 10
        );
    }
    
    public static Lead createBusinessLead() {
        return new Lead(
            LastName = 'Test Lead', Phone = '8734560945', MobilePhone = '7645093456', Work_Phone__c = '9923450921',
            RecordTypeId = LeadUtil.getRecordTypeId(LeadUtil.RT_BUSINESS) 
        );
    }

    public static Lead createWebLead() {
        return new Lead(
            LastName = 'Test Lead', Phone = '8734560945', MobilePhone = '7645093456', Work_Phone__c = '9923450921',
            RecordTypeId = LeadUtil.getRecordTypeId(LeadUtil.RT_WEB_LEAD) 
        );
    }

    public static Lead createListLead() {
        return new Lead(
            LastName = 'Test Lead', Phone = '8734560946', MobilePhone = '7645093456', Work_Phone__c = '9923450921',
            RecordTypeId = LeadUtil.getRecordTypeId(LeadUtil.RT_LIST_LEAD) 
        );
    }

    public static Lead createPreLead() {
        return new Lead(
            LastName = 'Test Lead', Phone = '8734560945', MobilePhone = '7645093456', Work_Phone__c = '9923450921',
            RecordTypeId = LeadUtil.getRecordTypeId(LeadUtil.RT_PRE_LEAD) 
        );
    }

    public static Account createAccount() {
        return new Account(
            FirstName = 'Test', LastName = 'Account', Phone = '8734560945', PersonMobilePhone = '7645093456',
            Work_Phone__c = '9923450921'
        );
    }

     public static Case createCase() {
        return new Case(
            Subject = 'Test Case Subject', Description = 'Test Case Description', Status = 'New'
        );
    }
    
    public static Opportunity createOpportunity() {
        return new Opportunity(
            Name = 'Hedy Greene Test', StageName = 'Closed Won', CloseDate = System.today(),
            Phone__c = '(608) 265-2215', Email__c = 'hedy.greene@test.com'
        );
    }

    public static Opportunity createOpportunity(String name, String stageName, Id accId) {
        return new Opportunity(
            Name = name, StageName = stageName, CloseDate = System.today(),
            Phone__c = '(608) 265-2215', Email__c = 'hedy.greene@test.com', AccountId = accId
        );
    }

    public static Program_Plan__c createProgramPlan(Id oppId, Id clientId, Id paymentProcessorId) {
        return new Program_Plan__c(
            Opportunity__c = oppId, Client__c = clientId, Payment_Processor__c = paymentProcessorId
        );
    }

    public static Debt_Details__c createDebtDetails(Id programPlanId) {
        return new Debt_Details__c(
            Program_Plan__c = programPlanId, Debt_Amount__c = 15000
        );
    }

    public static Offer__c createOffer(Id accountId, Id opportunityId, Id debtDetailId) {
        return new Offer__c(
            Client_Account__c = accountId, Opportunity__c = opportunityId, Debt_Details__c = debtDetailId, Offer_Status__c = 'Accepted'
        );
    }

    public static Settlement__c createSettlement(Id accountId, Id opportunityId, Id offerId) {
        return new Settlement__c(
            Client_Account__c = accountId, Opportunity__c = opportunityId, Offer__c = offerId, 
            Settlement_Date__c = System.today().addDays(5), AmountToCreditor__c = 500, Settlement_Status__c = 'Pending',
            Sync_Status__c = 'Sync Pending'
        );
    }

    public static Draft__c createDraft(Id programPlanId) {
        return new Draft__c(
            Draft_Date__c = System.today(), Draft_Amount__c = 100, Program_Plan__c = programPlanId,
            Retainer_Fee__c = 50, Setup_Fee__c = 50, Processor_Fee__c = 15, Service_Fee__c = 10, Program_Fee__c = 40
        );
    }

    public static Draft__c createDraft(Id programPlanId, String draftStatus, Date draftDate) {
        return new Draft__c(
            Draft_Date__c = (draftDate != null? draftDate : System.today().addDays(2)), Draft_Amount__c = 100, Program_Plan__c = programPlanId,
            Setup_Fee__c = 10, Retainer_Fee__c = 20, Processor_Fee__c = 30, Service_Fee__c = 40, Program_Fee__c = 10, Citadel_Fee__c = 100,
            Draft_Status__c = draftStatus
        );
    }
    
    public static Draft__c createDraftWithoutFee(Id programPlanId, String draftStatus, Date draftDate) {
        return new Draft__c(
            Draft_Date__c = (draftDate != null? draftDate : System.today().addDays(2)), Draft_Amount__c = 100, Program_Plan__c = programPlanId,
            Retainer_Fee__c = 0, Setup_Fee__c = 0, Processor_Fee__c = 0, Service_Fee__c = 0, Program_Fee__c = 0, Citadel_Fee__c = 0,
            Draft_Status__c = draftStatus
        );
    }
    
    public static Fee__c createFee(Id draftId, Integer feeAmount, date feeDate, String recordTypeName) {
        return new Fee__c(
            Draft__c = draftId, Fee_Amount__c = feeAmount, Fee_Date__c = feeDate,
            RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Fee__c', recordTypeName)
        );
    }

    public static Task createTask() {
        return new Task(
            Subject = 'Test Subject'
        );
    }

    public static Task createTask(String subject, Id recordTypeId, Id whoId) {
        return new Task(RecordtypeId = recordTypeId, Subject = subject, WhoId = whoId);
    }

    public static Event createEvent() {
        return new Event(
            Subject = 'Test Subject', DurationInMinutes  = 0, ActivityDateTime = System.now()
        );
    }
    public static Account createBusinessAccount() {
        return new Account(
            Name = 'John Tech LLC', SSN__c = '123456789', Phone = '123-456-7890', Lead_Number__c = '12345', 
            Program_Start_Date__c = Date.today(), Program_End_Date__c = Date.today().addDays(30), 
            RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'Business_Account'),
            BillingStreet = 'Ap #696-3279 Viverra. Avenue', BillingCity = 'Latrobe', BillingStateCode = 'DE', 
            BillingPostalCode = '38100', BillingCountryCode = 'US'
        );
    }
    
    public static Account createCreditorAccount() {
        return new Account(
            Name = 'John Tech LLC', Phone = '123-456-7890', EIN_Number_Tax_Id__c = '123456789',
            RecordTypeId = AccountUtil.getRecordTypeId(AccountUtil.RT_CREDITOR),Creditor_Category__c = 'Citadel',
            BillingStreet = 'Ap #696-3279 Viverra. Avenue', BillingCity = 'Latrobe', BillingStateCode = 'DE', 
            BillingPostalCode = '38100', BillingCountryCode = 'US'
        );
    }

    public static Contact createContact() {
        return new Contact(
            FirstName = 'Jane', LastName = 'Smith', Email = 'jane.smith@example.com', MailingStreet = '456 Elm St', 
            MailingCity = 'Los Angeles', MailingCountry = 'United States', MailingState = 'California', 
            MailingPostalCode = '90001', Lead_Number__c = '12345', Phone = '8734560945', MobilePhone = '7645093456',
            SSN_Encrypted__c = '123123123'
        );
    }

    public static Contact createContact(Id acctId) {
        return new Contact(
            FirstName = 'Jane', LastName = 'Smith', Email = 'jane.smith@example.com', MailingStreet = '456 Elm St', 
            MailingCity = 'Los Angeles', MailingCountry = 'United States', MailingState = 'California', 
            MailingPostalCode = '90001', Lead_Number__c = '12345', Phone = '8734560945', MobilePhone = '7645093456',
            SSN_Encrypted__c = '123123123', AccountId = acctId
        );
    }

    public static Account createPersonAccount() {
        return new Account(FirstName = 'John', LastName = 'Doe', PersonEmail = 'john.doe@example.com', PersonMailingStreet = '123 Main St', 
            PersonMailingCity = 'New York', PersonMailingCountry = 'United States', PersonMailingState = 'New York', PersonMailingPostalCode = '10001',
            SSN__c = '123456789', Phone = '1234567890', Lead_Number__c = '12345', Program_Start_Date__c = Date.today(), Bank_Name__c = 'Wells Fargo',
            Bank_Account_Number__c = '13719713158835300', Bank_Routing_Number__c = '122105155', Program_End_Date__c = Date.today().addDays(30), 
            RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'PersonAccount'), PersonMobilePhone='9087654321', Work_Phone__c='9987654321'
        );
    }
    public static SMS__c createOutboundSMS() { 
        return new SMS__c(
            From_Phone__c = '6498345678', To_Phone__c = '8734560945', Message_Body__c = 'Test SMS'
        );
    }

    public static SMS__c createInboundSMS() { 
        return new SMS__c(
            From_Phone__c = '8734560945', To_Phone__c = '6498345678', Message_Body__c = 'Test SMS', Is_Inbound__c = true
        );
    }

    public static User createUser(Id profileId) {
        return new User(ProfileId = profileId, LastName = 'last', Email = 'puser000@amamama.com',
            Username = 'puser000@amamama.com' + System.currentTimeMillis(), CompanyName = 'TEST',
            Title = 'title', Alias = 'alias', TimeZoneSidKey = 'America/Los_Angeles', EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'en_US', LocaleSidKey = 'en_US'
        );
    }

    public static Payment_Calculator_Settings__c createPaymentCalculatorSettings() {
        return new Payment_Calculator_Settings__c(
            Monthly_Service_Fee__c = 50
        );
    }

    public static SMS_Template__mdt createSMSTemplate() {
        return new SMS_Template__mdt(
            Object__c = 'Lead', SMS_Body__c = 'Test Body', SMS_Template_Name__c = 'Test Template'
        );
    }
    
    public static List<SASInboundAPIMapping__mdt> createSASInbound() {
        return new List<SASInboundAPIMapping__mdt>{
             new SASInboundAPIMapping__mdt(API_Call_Name__c = 'Draft Update', SAS_Attribute_Name__c = 'debits_id', SF_Field_Name__c = 'External_SAS_Id__c'),
             new SASInboundAPIMapping__mdt(API_Call_Name__c = 'Draft Update', SAS_Attribute_Name__c = 'debit_remoteid', SF_Field_Name__c = 'Id'),
             new SASInboundAPIMapping__mdt(API_Call_Name__c = 'Draft Update', SAS_Attribute_Name__c = 'paymentstatus', SF_Field_Name__c = 'Draft_Status__c')
         };
    }
    
    public static List<SetupFee__mdt> createSetupFeeMapping() {
        return new List<SetupFee__mdt>{
             new SetupFee__mdt(Fee__c = 995),
             new SetupFee__mdt(Fee__c = 850)
         };
    }
    
    public static List<RAM_Payment_Status_Mapping__mdt> createRAMPaymenteStatusMapping() {
        return new List<RAM_Payment_Status_Mapping__mdt>{
             new RAM_Payment_Status_Mapping__mdt(SF_Draft_Status__c = 'Completed', RAM_Draft_Status__c = 'POSTED'),
             new RAM_Payment_Status_Mapping__mdt(SF_Draft_Status__c = 'Cancelled', RAM_Draft_Status__c = 'VOIDED')
         };
    }
    
    public static List<SAS_Payment_Status_Mapping__mdt> createSASPaymenteStatusMapping() {
        return new List<SAS_Payment_Status_Mapping__mdt>{
             new SAS_Payment_Status_Mapping__mdt(SF_Draft_Status__c = 'Completed', SAS_Draft_Status__c = 'Successful'),
             new SAS_Payment_Status_Mapping__mdt(SF_Draft_Status__c = 'NSF', SAS_Draft_Status__c = 'Failed')
         };
    }


    //Method to create Content Version test record instance
    public static ContentVersion createContentVersion() {
        return new ContentVersion(
            Title = 'Test Document',
            PathOnClient = 'TestDocument.pdf',
            VersionData = Blob.valueOf('Test Content'),
            IsMajorVersion = true
        );
    }

    //Method to create test record instance for Content Document Link
    public static ContentDocumentLink createContentDocumentLink(Id linkedEntityId, Id contentDocumentId) {
        return new ContentDocumentLink(
            LinkedEntityId = linkedEntityId, ContentDocumentId = contentDocumentId, Visibility = 'AllUsers'
        );
    }

    //Method to created test record instance for DocuSign Envelope Status record
    public static dfsle__EnvelopeStatus__c createDS_EnvelopeStatus() {
        return new dfsle__EnvelopeStatus__c(
            dfsle__Status__c = 'Sent', dfsle__DocuSignId__c = '649662b7-632c-42c9-81d0-ed3ba152751e'
        );
    }

    //Method to created test record instance for DocuSign Envelope record
    public static dfsle__Envelope__c createDS_Envelope() {
        return new dfsle__Envelope__c(
            dfsle__DocuSignId__c = '649662b7-632c-42c9-81d0-ed3ba152751e'
        );
    }

    //Method to created test record instance for DocuSign Document record
    public static dfsle__Document__c createDS_Document() {
        return new dfsle__Document__c(
            dfsle__FullName__c = 'Test Document', dfsle__Type__c = 'ContentVersion'
        );
    }
    
    public static Sync_Redial_Time__c createSyncRedialTime() {
        return new Sync_Redial_Time__c(
            Last_Run_Time__c = System.now()
        );
    }

    /**
     * @description: A method to create the test record for the SAS Settings
    **/
    public static SAS_Settings__c createSASSettings() {
        return new SAS_Settings__c(
            Endpoint__c = 'https://test.com'
        );
    }

    //Method to create test group record
    public static Group createGrouop() {
        return new Group(Name = 'Test Public Group', Type = 'Regular'); 
    }
    
     //Method to create test queue group record
     public static Group createQueueGroup() {
        return new Group(Name = 'Test Queue', Type = 'Queue'); 
    }

    //Method to create test group member with the parent group
    public static GroupMember createGroupMember(Id groupId) {
        return new GroupMember(UserOrGroupId = UserInfo.getUserId(), GroupId = groupId);
    }
    
    //Method to create test Five9 List instance
    public static Five9LSP__Five9_List__c createFive9List() {
        Five9LSP__Five9_List__c five9List = new Five9LSP__Five9_List__c();
        five9List.Name = System.Label.Five9_List_Name;
        five9List.Five9LSP__API_URL__c = 'https://api.five9.test';
        five9List.Five9LSP__Controlling_Object__c = 'lead';
        five9List.Five9LSP__Field_Mapping__c = '{"zip":"postalcode","vendor_id":"lead_vendor_id_text__c","vendor_code":"vendor_code__c",'
        +'"ucc_filling_date":"ucc_filing_date__c","street":"street","state":"state","revanue_amount":"monthly_revenue__c",'
        +'"number2":"mobilephone","number1":"phone","loan_amount_MCA":"mca_amount__c","lender":"lenders__c","last_name":"lastname",'
        +'"industry":"industry","first_name":"firstname","fax":"fax","email":"email",'
        +'"current_total_debt_amount":"current_total_debt_amount__c","company":"company","city":"city",'
        +'"business_start_date":"business_start_date__c","Priority":"hopper_priority__c","Lead Created Date":"createddate",'
        +'"F9CallASAP":"call_asap__c","8b3f690b-0a7e-4b54-af6b-4783841a5d3d":"outbound_ani_identifier__c",'
        +'"43052dd1-b2e1-4e38-b607-b71daef3091b":"outbound_ani_from__c","409b1bbd-abdd-4377-abef-e4bfdf416ced":"outbound_ani_date__c"}';
        five9List.Five9LSP__Five9_Call_ASAP__c = false;
        five9List.Five9LSP__Five9_Domain__c = 'Coastal Debt Resolve Test';
        five9List.Five9LSP__Five9_User_Name__c = 'Five9APIuser@CoastalDebtResolve.Test';
        five9List.Five9LSP__Five9_User_Password__c = '36&aw{T7hbss';
        five9List.Five9LSP__VCC_Cache__c = '{"closerAHNumber":"PHONE","agentSkill":"STRING","agentEmail":"STRING","agentType":"STRING","isAgent":"BOOLEAN","Lead Created Date":"DATE_TIME(MM/dd/yyyy HH:mm:ss.SSS)"}';
        return five9List;
    }
    
    public static five9_lsp2__Five9_Data_Center__c createFive9Lsp2DataCenter(){
      five9_lsp2__Five9_Data_Center__c five9DataCenter = New five9_lsp2__Five9_Data_Center__c();
        five9DataCenter.five9_lsp2__API_URL__c = 'https://api.five9.test';
        five9DataCenter.Name = 'Test Data Center';
        five9DataCenter.five9_lsp2__Is_Enabled__c = true;
        return five9DataCenter;
    }
    
    
    public static five9_lsp2__Five9_Domain__c createFive9Lsp2Domain(Id five9Lsp2DataCenterId){
        five9_lsp2__Five9_Domain__c five9Domain = New five9_lsp2__Five9_Domain__c();
        five9Domain.five9_lsp2__Data_Center__c = five9Lsp2DataCenterId;
        five9Domain.Name = 'Test Domain';
        five9Domain.five9_lsp2__Is_Enabled__c = true;
        five9Domain.five9_lsp2__Username__c = 'username';
        five9Domain.five9_lsp2__Password__c = 'password';
        five9Domain.five9_lsp2__Is_License_Enabled__c = true;
        five9Domain.five9_lsp2__Is_Connection_Successful__c = true;
        return five9Domain;
    }
    
    public static five9_lsp2__Five9_Object_Fields_Mapping__c createFive9Lsp2ObjectFieldMapping(Id five9DomainId){
        five9_lsp2__Five9_Object_Fields_Mapping__c objectFieldMapping = New five9_lsp2__Five9_Object_Fields_Mapping__c();
        objectFieldMapping.five9_lsp2__Object_Name__c = 'Lead';
        objectFieldMapping.Name = 'Lead Mapping';
        objectFieldMapping.five9_lsp2__Domain__c = five9DomainId;
        return objectFieldMapping;
    }
    
    //Method to create test Five9 List instance
    public static five9_lsp2__Five9_List_Config__c createFive9Lsp2List(Id objectFieldMappingId) {
        five9_lsp2__Five9_List_Config__c five9List = new five9_lsp2__Five9_List_Config__c();
        five9List.five9_lsp2__Five9_List_Name__c = System.Label.Five9_List_Name;
        five9List.five9_lsp2__Object_Fields_Mapping__c = objectFieldMappingId;
        five9List.five9_lsp2__Is_Enabled__c = true;
        return five9List;
    }

    //Method to create test Five9 List instance
    public static Five9LSP__Five9_List__c createFive9ListOpportunity() {
        Five9LSP__Five9_List__c five9List = new Five9LSP__Five9_List__c();
        five9List.Name = System.Label.Five9_List_Name;
        five9List.Five9LSP__API_URL__c = 'https://api.five9.test';
        five9List.Five9LSP__Controlling_Object__c = 'Opportunity';
        five9List.Five9LSP__Field_Mapping__c = '{"Dialer Group":"dialer_group__c","  Language":"preferred_language__c","  current_total_debt_amount":"current_total_debt__c",'
        +'"  email":"email__c","f9_contact_create_date":"createddate","number1":"phone__c","opportunity_id":"id",'
        +'"state":"state__c"}';
        five9List.Five9LSP__Five9_Call_ASAP__c = false;
        five9List.Five9LSP__Five9_Domain__c = 'Coastal Debt Resolve Test';
        five9List.Five9LSP__Five9_User_Name__c = 'Five9APIuser@CoastalDebtResolve.Test';
        five9List.Five9LSP__Five9_User_Password__c = '36&aw{T7hbss';
        //five9List.Five9LSP__VCC_Cache__c = '{"closerAHNumber":"PHONE","agentSkill":"STRING","agentEmail":"STRING","agentType":"STRING","isAgent":"BOOLEAN","Lead Created Date":"DATE_TIME(MM/dd/yyyy HH:mm:ss.SSS)"}';
        return five9List;
    }
    //Method to create test Five9 List Item
    public static Five9LSP__Five9_List_Item__c createFive9ListItem(Id five9ListId, Id leadId) {
        return new Five9LSP__Five9_List_Item__c(
            Five9LSP__Five9_List__c = five9ListId, Five9LSP__Lead__c = leadId, Five9LSP__Sync_Status__c = 'Pending'
        );
    }

    //Method to create Five9 LSP Settings test instance
    public static Five9LSP__Five9_LSP_Settings__c createFive9Settings() {
        return new Five9LSP__Five9_LSP_Settings__c(
            Name = 'LSPDEFAULT', Five9LSP__API_Batch_Size__c = 1, Five9LSP__API_Ongoing_Batch_Size__c = 0, 
            Five9LSP__Admin_Email_Subject__c = 'Five9 List Authentication Failure', 
            Five9LSP__Defer_List_Item_Delay__c =  15, Five9LSP__Statuses_to_retry__c = 'pending',
            Five9LSP__Admin_Email__c = 'sample@company.test'
        );
    }
    
     public static Five9_API__c createFive9ApiSettings() {
        return new Five9_API__c(
            Name = 'LSPDEFAULT', API_URL__c = 'https://api.five9.test',
            Api_User_Name__c = 'username',
            Api_User_Password__c = 'Password'
        );
    }
    
    //Method to create the campaign
    public static Campaign createCampaign() {
        return new Campaign(Name = 'Test Campaign');
    }

    //Method to create the campaign member
    public static CampaignMember createCampaignMember(Id campaignIdValue, Id leadIdValue) {
        return new CampaignMember(LeadId = leadIdValue, campaignId = campaignIdValue);
    }

    //Create Product2
    public static Product2 createProduct() {
        return new Product2(Name = ProductAndPriceBookUtil.PRODUCT_CITADEL_FEE, ProductCode = FeeUtil.PRODUCT_CITADEL_FEE, IsActive = true);
    }

    public static Pricebook2 createPriceBook() {
        return new Pricebook2(Name = ProductAndPriceBookUtil.PRICE_BOOK_SAS, IsActive = true);
    }

    //Create PricebookEntry Id
    public static PricebookEntry createPriceBookEntryId(Id pricebook2Id, Id product2Id) {
        return new PricebookEntry(IsActive = true, Pricebook2Id = pricebook2Id, Product2Id = product2Id, UnitPrice = 10);
    }

    //Create Opportunity Line Item
    public static OpportunityLineItem createOppLineItem(Id oppId, Id product2Id, Id pricebookEntryId) {
        return new OpportunityLineItem(OpportunityId = oppId, Product2Id = product2Id, PricebookEntryId = pricebookEntryId, Quantity = 1, TotalPrice = 100);
    }

    /**
     * @description: A method to create the test record for the RAM Settings
    **/
    public static RAMS_Settings__c createRAMSettings() {
        return new RAMS_Settings__c(
            Affiliate_ID__c='123',APIKey__c ='4654651',Endpoint__c ='https://test.com',Fee_Split_Group_ID__c='452'
        );
    }
    
    /**
     * @description: A method to create the test record for the Citadel Settings
    **/
    public static Citadel_Callout_Settings__c createCitadelSettings() {
        return new Citadel_Callout_Settings__c(
            Endpoint__c = 'https://test.com'
        );
    }
    
    /**
     * @description: A method to create the test record for the Twilio Settings
    **/
    public static TwilioConfig__c createTwilioSettings() {
        return new TwilioConfig__c(
            AccountSid__c ='7455', ApplicationSid__c ='478RES', AuthToken__c='787454'
        );
    }

    public static List<Append_Leads_Mapping__mdt> createAppendLeadsMapping() {
        return new List<Append_Leads_Mapping__mdt> {
            new Append_Leads_Mapping__mdt(Source_Field__c = 'Business_Start_Date__c', Target_Field__c = 'Business_Start_Date__c')
        };
    }

    public static Offer__c createOffer(Id debtDetailsId) {
        return new Offer__c(
            Debt_Details__c = debtDetailsId, Settlement_Frequency__c = 'Monthly', Settlement_Term__c = '6',
            Start_Date__c = System.today(), Offer_Status__c = 'In Review'
        );
    }

    public static Settlement__c createSettlement(Id offerId) {
        return new Settlement__c(
            AmountToCreditor__c = 200, Offer__c = offerId, Settlement_Date__c = System.today().addDays(1)
        );
    }
    
    public static Five9_Call_Log__c createFive9CallLog(){
        return new Five9_Call_Log__c(
            Disposition__c = 'CALL TRANSFERRED'
        );
    }
    
    public static Async_Operation__c createAsyncOperation(){
        return new Async_Operation__c(
            Operation__c = 'Remove Lead From Five9 - Lead Final Disposition',
            Status__c = 'In Progress',
            Async_Type__c = 'Batch'
        );
    }
}