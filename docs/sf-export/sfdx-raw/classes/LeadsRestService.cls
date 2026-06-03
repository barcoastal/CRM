/**
* @Description: Leads rest resource to create leads in Salesforce CRM from third party services. 
* Security: API_KEY provided through API should be validated in salesforce to enforce some level of security. 
*/

@RestResource(urlMapping='/Leads/*')
global without sharing class LeadsRestService {
    @HttpPost
    global static String doPost(){
        RestRequest request = RestContext.request; 
        RestResponse response = RestContext.response; 
        String responseMessage = 'Sync to CRM Successful';
        //formLeadInstance(request.params);
        return responseMessage;
    }
}