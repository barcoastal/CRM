/**
* @Description: WebLeads rest resource to create leads in Salesforce CRM from third party services.
*/

@RestResource(urlMapping='/WebLeads/*')
global with sharing class WebLeadsRestService {
    
    /**
     * @description: Method to which takes only few parameters.
     * @return responseMessage sent back to acknowledge whether the callout success or failed.
     * The list of params which are supported are 
     * first_name
     * last_name
     * email
     * phone_number
     * state
     * lead_source
     * vendor_id
     * ad_id
     * campaign_name
     * has_multiple_mca
     * estimated_total_debt
     */

    public static final String NO_DATA = '--No Data--';
    public static final String COUNTRY_CODE = 'US';
    public static final String COUNTRY = 'United States';
    public static final String NO_RESPONSE_BODY = 'No request params found.';
    public static final String ERROR_RESPONSE = 'Technical error please reach out the system admin.';
    public static final String SUCCESS_RESPONSE = 'Sync to CRM Successful';
    public static final String EMAIL_NOT_VALID_MESSAGE = 'Email is not in valid format, email received is ';
    public static final String STATE_NOT_VALID_MESSAGE = 'State is not valid, state value received is ';
    public static final String SEVERITY_LOW = 'Low';
    public static final String SEVERITY_HIGH = 'High';
    public static final List<String> BOOLEAN_VALUE_LIST = new List<String> {'FALSE', 'TRUE'};
    

    @HttpPost
    global static String doPost(){

        RestRequest request = RestContext.request;
        String responseMessage = formLeadInstance(request.params);
        return responseMessage;
    }

    private static String formLeadInstance(Map<String, String> leadKeyValueMap) {
        
        if (!leadKeyValueMap.isEmpty()) {
            try {
                String errorMessage;
                Lead leadInstance =  new Lead();
                leadInstance.FirstName = leadKeyValueMap.get('first_name');
                //Last name should be unique to avoid any duplication rule.
                leadInstance.LastName = String.isNotBlank(leadKeyValueMap.get('last_name')) ? leadKeyValueMap.get('last_name') :  NO_DATA + System.now();
                if (ApexUtil.validateEmailId(leadKeyValueMap.get('email'))) {
                    leadInstance.Email = leadKeyValueMap.get('email');
                } else {
                    errorMessage = String.isNotBlank(leadKeyValueMap.get('email')) ? EMAIL_NOT_VALID_MESSAGE + leadKeyValueMap.get('email') + '.' : '';
                }
                leadInstance.Phone = leadKeyValueMap.get('phone_number');
                if (StateCodeUtil.isValidState(leadKeyValueMap.get('state'))) {
                    if (leadKeyValueMap.get('state').length() == 2) {
                        leadInstance.StateCode = leadKeyValueMap.get('state');
                        leadInstance.CountryCode = COUNTRY_CODE;
                    } else {
                        leadInstance.State = leadKeyValueMap.get('state');
                        leadInstance.Country = COUNTRY;
                    }
                } else {
                    errorMessage += leadKeyValueMap.get('state') != null ? STATE_NOT_VALID_MESSAGE + leadKeyValueMap.get('state') + '.' : ''; 
                }
                leadInstance.LeadSource = leadKeyValueMap.get('lead_source');
                leadInstance.Lead_Vendor_Id_Text__c = leadKeyValueMap.get('vendor_id');
                leadInstance.Ad_Id__c = leadKeyValueMap.get('ad_id');
                leadInstance.Campaign_Name__c = leadKeyValueMap.get('campaign_name');
                if (String.isNotBlank(leadKeyValueMap.get('has_multiple_mca')) && BOOLEAN_VALUE_LIST.contains(leadKeyValueMap.get('has_multiple_mca').toUpperCase())) {
                    leadInstance.Has_Multiple_MCA_s__c = Boolean.valueOf(leadKeyValueMap.get('has_multiple_mca'));
                }
                leadInstance.Estimated_Total_Debt__c = leadKeyValueMap.get('estimated_total_debt');
                insert leadInstance;
    
                if (String.isNotBlank(errorMessage)) {
                    ApplicationLogger.logNotificationWithData(JSON.serialize(leadKeyValueMap), errorMessage, leadInstance.Id, SEVERITY_LOW);
                }
            } catch(Exception exp) {
                /* Storing exception details along with data to the application logger. */
                ApplicationLogger.logExceptionWithData(exp, null, JSON.serialize(leadKeyValueMap), SEVERITY_HIGH);
                return ERROR_RESPONSE;
            }
            return SUCCESS_RESPONSE;
        }
        return NO_RESPONSE_BODY;
    }
}