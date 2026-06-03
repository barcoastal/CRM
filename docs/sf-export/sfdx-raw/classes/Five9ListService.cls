/*---------------------------------------------------------------------------------------------------
    Author: Dharanya Sekar
    Description: Service Class to process five9 list with five9 list items and invoke the five9 API callout
    Test Class: Five9ListService_Test

    History
    <Date>           <Authors Name>          <Brief Description of Change>       <Code Coverage>
    Mar-20-2024       Dharanya Sekar           Initial Development                 98%
------------------------------------------------------------------------------------------------------*/
public inherited sharing class Five9ListService {

    public static final String ENVELOPE = 'http://schemas.xmlsoap.org/soap/envelope/';
    public static final String SER = 'http://service.admin.ws.five9.com/';
    
    //Method to get the endpoint url by appending the base url from five9 list record
    public static String getEndpoint(String baseURL) {
        if (String.isNotBlank(baseURL)) {
            return baseURL+'/wsadmin/v13/AdminWebService';
        }
        return null;
    }

    //Method to check if the required values are available for the five9 callout authorization
    public static Boolean hasAuthorization(five9_lsp2__Five9_List_Config__c five9Lsp2List) {
        return five9Lsp2List != null && String.isNotBlank(five9Lsp2List.five9_lsp2__Object_Fields_Mapping__c) &&
        five9Lsp2List.five9_lsp2__Is_Enabled__c != False;
    }

    //Construct the encoded base64 basic auth for the authorization using username and password
    private static String getBasicAuth(Five9_API__c five9ApiSettings) {
        //Construct "Basic <Base64 encoded username and password>"
        return 'Basic '+EncodingUtil.base64Encode(Blob.valueOf(
            five9ApiSettings.Api_User_Name__c + ':' + five9ApiSettings.Api_User_Password__c
        ));
    }

    //Method to get the five9 list item statuses to retry
    public static List<String> getFive9StatusesToRetry() {
        List<String> statusesToRetry = new List<String>();
        Five9LSP__Five9_LSP_Settings__c five9Settings = Five9ListData.getFive9Settings();
        if (five9Settings != null && String.isNotBlank(five9Settings.Five9LSP__Statuses_to_retry__c)) {
            statusesToRetry = five9Settings.Five9LSP__Statuses_to_retry__c.replaceAll('\'', '').split(',');
        }
        return statusesToRetry;
    }

    //Method to construct and return the request wrapper with endpoint, body and header.
    public static HttpClient constructRequestWrapper(String endpoint, DOM.Document document, Five9_API__c five9ApiSettings) {
        HttpClient httpInstance = new HttpClient();
        httpInstance.method = HttpClient.Methods.POST;
        httpInstance.endpoint = endpoint;
        httpInstance.bodyDocument = document;
        Map<String, String> headerMap = new Map<String, String> ();
        headerMap.put('Content-Type', 'text/xml;charset=UTF-8');
        //Method call to construct and return the basic auth for authorization
        headerMap.put('Authorization', getBasicAuth(five9ApiSettings));
        httpInstance.headerMap = headerMap;
        httpInstance.timeout = 120000; 
        return httpInstance;
    }
    
    //Method to construct xml body document for addtoFive9 list
    public static DOM.Document addtoFive9List(String five9ListName, Set<Id> leadIds,  Map<String, Object> fieldMappingObject) {
        DOM.Document document = new DOM.Document();
        DOM.XmlNode body = createDocumentBody(document);
        DOM.XmlNode addToList =  body.addChildElement('addToList', ser , 'ser');
        addToList.addChildElement('listName', null, null).addTextNode(five9ListName);
        DOM.XmlNode listUpdateSettings = addToList.addChildElement('listUpdateSettings', null, null);
        //Method call to create the listUpdateSettings node with its nested nodes to store Five9 configurations.
        listUpdateSettings = createListUpdateSettingsNode(listUpdateSettings, fieldMappingObject.keySet());
        DOM.XmlNode importData = addToList.addChildElement('importData', null, null);
        //Method call to create the importData node with its nested nodes to store SF data.
        importData = createImportDataWithValueNodes(importData, leadIds, fieldMappingObject.values());
        return document;
    }

    //Method to create a DOM document with the header and the body
    private static DOM.XmlNode createDocumentBody(DOM.Document document) {
        DOM.XmlNode envelopeNode  = document.createRootElement('Envelope', ENVELOPE, 'soapenv');
        envelopeNode.setNamespace('ser', SER);
        DOM.XmlNode header =  envelopeNode.addChildElement('Header', ENVELOPE, 'soapenv');
        DOM.XmlNode body =  envelopeNode.addChildElement('Body', ENVELOPE, 'soapenv');
        return body;
    }

    //Method to create listUpdateSettings node with the five9 list configuration and five9 field names in the nested nodes.
    private static DOM.XmlNode createListUpdateSettingsNode(DOM.XmlNode listUpdateSettings, Set<String> five9FieldNameSet) {
        listUpdateSettings.addChildElement('allowDataCleanup', null, null).addTextNode('True');
        listUpdateSettings.addChildElement('countryCode', null, null).addTextNode('US');
        listUpdateSettings.addChildElement('failOnFieldParseError', null, null).addTextNode('false');
        //Method call to create nodes of five9 field names with a series of number
        listUpdateSettings = createFieldMappingNodes(listUpdateSettings, five9FieldNameSet);
        //Method call to create node for report email from the custom settings
        listUpdateSettings = createReportEmailNode(listUpdateSettings);
        listUpdateSettings.addChildElement('separator', null, null).addTextNode(',');
        listUpdateSettings.addChildElement('skipHeaderLine', null, null).addTextNode('false');
        listUpdateSettings.addChildElement('callNowMode', null, null).addTextNode('NONE');
        //Note: Never make this cleanListBeforeUpdate as true which removes all the records from five9 list
        listUpdateSettings.addChildElement('cleanListBeforeUpdate', null, null).addTextNode('false');
        listUpdateSettings.addChildElement('crmAddMode', null, null).addTextNode('ADD_NEW');
        listUpdateSettings.addChildElement('crmUpdateMode', null, null).addTextNode('UPDATE_FIRST');
        listUpdateSettings.addChildElement('listAddMode', null, null).addTextNode('ADD_FIRST');
        return listUpdateSettings;
    }

    //Method to create fieldMapping nodes of the five9 field names with the series of number starting from 1
    private static DOM.XmlNode createFieldMappingNodes(DOM.XmlNode listUpdateSettings, Set<String> five9FieldNameSet) {
        if (five9FieldNameSet != null && !five9FieldNameSet.isEmpty()) {
            //Initialize the counter value which increments upto the size of five9 field names 
            //and added in the five9 field mapping node to map with sf field values.
            Integer counter = 1;
            for (String five9FieldName : five9FieldNameSet) {
                DOM.XmlNode fieldMapping = listUpdateSettings.addChildElement('fieldsMapping', null, null);
                //Incrementing the counter value of the column number node
                fieldMapping.addChildElement('columnNumber', null, null).addTextNode(String.valueOf(counter++));
                fieldMapping.addChildElement('fieldName', null, null).addTextNode(five9FieldName);
                fieldMapping.addChildElement('key', null, null).addTextNode(
                    five9FieldName == 'lead_id' ? 'true' : 'false'
                );
            }
        }
        return listUpdateSettings;
    }

    //Method to create node for report email from custom settings which stores the email to send the result of the api callout. 
    private static DOM.XmlNode createReportEmailNode(DOM.XmlNode listUpdateSettings) {
        Five9LSP__Five9_LSP_Settings__c five9Settings = Five9ListData.getFive9Settings();
        if (five9Settings != null && String.isNotBlank(five9Settings.Five9LSP__Admin_Email__c)) {
            listUpdateSettings.addChildElement('reportEmail', null, null).addTextNode(five9Settings.Five9LSP__Admin_Email__c);
        }
        return listUpdateSettings;
    }

    // //Method to create ImportData node with the SF data as an item nodes
    // private static DOM.XmlNode createImportDataWithValueNodes(DOM.XmlNode importData, List<Five9LSP__Five9_List_Item__c> five9ListItems, List<Object> sfFieldNames) {
    //     //Method call to get the set of lead Ids in the five9 list items to sync
    //     Set<Id> leadIdSet = Five9ListData.getLeadIdSet(five9ListItems);
    //     //Construct a map to get the lead values based on the lead Id to create item node
    //     Map<Id, Lead> leadMap = new Map<Id, Lead>(
    //         LeadData.getLeadList(sfFieldNames, leadIdSet)
    //     );
    //     for (Five9LSP__Five9_List_Item__c listItem : five9ListItems) {
    //         Lead leadInstance = leadMap.get(listItem.Five9LSP__Lead__c);
    //         if (leadInstance != null && !sfFieldNames.isEmpty()) {
    //             DOM.XmlNode values = importData.addChildElement('values', null, null);
    //             for (Object sfFieldNameObj : sfFieldNames) {
    //                 //Method call to create item node based on the SF field name and SF field value
    //                 values = createItemNode(sfFieldNameObj, leadInstance, values);
    //             }
    //         }
    //     }
    //     return importData;
    // }

    //Method to create Item node based on the Salesforce data.
    private static DOM.XmlNode createItemNode(Object sfFieldName, Lead leadInstance, DOM.XmlNode valuesNode) {
        if (sfFieldName != null) {
            String fieldValue = String.valueOf(leadInstance.get((String)sfFieldName));
            if (String.isNotBlank(fieldValue)) {
                valuesNode.addChildElement('item', null, null).addTextNode(fieldValue);
            } else {
                //If the Salesforce field value is blank, empty item node is added to match the five9 field name series.
                valuesNode.addChildElement('item', null, null);
            }
        }
        return valuesNode;
    }

    //Method to get the document response body xml node which contains the response message
    public static DOM.XmlNode getBodyResult(String responseBody) {
        Dom.XMLNode bodyResult;
        Dom.Document docResult = new Dom.Document();
        docResult.load(responseBody);
        Dom.XMLNode envelopeResult = docResult.getRootElement();
        if (envelopeResult != null && envelopeResult.getChildElements().size() > 0) {
            bodyResult = envelopeResult.getchildElement('Body', ENVELOPE);
        }
        return bodyResult;
    }

    //Method to parse and return the success message by traversing the response body xml nodes
    public static String parseSuccessResponse(String calloutName, DOM.XmlNode bodyResult) {
        String responseMessage = '';
        if (bodyResult != null && bodyResult.getChildElement(calloutName, SER) != null 
            && bodyResult.getChildElement(calloutName, SER).getChildElement('return', null) != null
            && bodyResult.getChildElement(calloutName, SER).getChildElement('return', null).getChildElement('identifier', null) != null
           ) {
               responseMessage = bodyResult.getChildElement(calloutName, SER).getChildElement('return', null).getChildElement('identifier', null).getText();  
           }
        else if (bodyResult != null && bodyResult.getChildElement(calloutName, SER) != null 
                 && bodyResult.getChildElement(calloutName, SER).getChildElement('return', null) != null
                 && bodyResult.getChildElement(calloutName, SER).getChildElement('return', null).getChildElement('identifier', null) == null)
        {
            responseMessage = bodyResult.getChildElement(calloutName, SER).getChildElement('return', null).getText();  
        }
        return responseMessage; 
    }

    //Method to parse and return the fault message by traversing the response body xml nodes
    public static String parseFaultResponse(DOM.XmlNode bodyResult) {
        String responseMessage = '';
        if (bodyResult != null && bodyResult.getChildElement('Fault', ENVELOPE) != null 
            && bodyResult.getChildElement('Fault', ENVELOPE).getChildElement('faultstring', null) != null
           ) {
               responseMessage = bodyResult.getChildElement('Fault', ENVELOPE).getChildElement('faultstring', null).getText();
               //Method call to get the detail of fault message by traversing the detail node
               responseMessage = getFaultResponseDetail(bodyResult);
           }
        return responseMessage;
    }

    //Method to parse and return the detail of the fault message by traversing the detail node
    private static String getFaultResponseDetail(DOM.XmlNode bodyResult) {
        String responseMessage = '';
        if (bodyResult.getChildElement('Fault', ENVELOPE).getChildElement('detail', null) != null
            && bodyResult.getChildElement('Fault', ENVELOPE).getChildElement('detail', null).getChildElements() != null                           
        ) {
            Dom.XMLNode exceptionNode = bodyResult.getChildElement('Fault', ENVELOPE).getChildElement('detail', null).getChildElements()[0];
            responseMessage = exceptionNode.getName();
            if (exceptionNode.getChildElement('fieldName', null) != null) {
                responseMessage += '\nFieldName: ' + exceptionNode.getChildElement('fieldName', null).getText();
            }
            if (exceptionNode.getChildElement('message', null) != null) {
                responseMessage += '\nMessage: '+ exceptionNode.getChildElement('message', null).getText();
            }
        }
        return responseMessage;
    }
    
    
    //Method to parse and return the fault message by traversing the response body xml nodes
    public static String parseFaultResponseForAddRemoveNumbersFromDNC(DOM.XmlNode bodyResult){
        String responseMessage = '';
        if (bodyResult != null 
            && bodyResult.getChildElement('Body', ENVELOPE)!=null
            && bodyResult.getChildElement('Body', ENVELOPE).getChildElement('Fault', ENVELOPE)!=null
            && bodyResult.getChildElement('Body', ENVELOPE).getChildElement('Fault', ENVELOPE).getChildElement('faultstring', null)!=null) {
                responseMessage = bodyResult.getChildElement('Body', ENVELOPE).getChildElement('Fault', ENVELOPE).getChildElement('faultstring', null).getText();
                
                System.debug('Response Message: ' + responseMessage);
            }
        
        return responseMessage;
    }
    
    //Method to construct xml body document for addNumbersToDnc
    public static DOM.Document addNumbersToDnc(List<String> numbers) {
        DOM.Document document = new DOM.Document();
        DOM.XmlNode body = createDocumentBody(document);
        DOM.XmlNode addNumbersToDnc = body.addChildElement('addNumbersToDnc', ser, 'ser');
        // Adding numbers to DNC
        for(String num : numbers) {
            addNumbersToDnc.addChildElement('numbers', null, null).addTextNode(num);
        }
        return document;
    }
   //Method to construct xml body document for removeNumbersFromDnc
    public static DOM.Document removeNumbersFromDnc(List<String> numbers) {
        DOM.Document document = new DOM.Document();
        DOM.XmlNode body = createDocumentBody(document);
        DOM.XmlNode removeNumbersFromDnc = body.addChildElement('removeNumbersFromDnc', ser, 'ser');
        // remove numbers from DNC
        for(String num : numbers) {
            removeNumbersFromDnc.addChildElement('numbers', null, null).addTextNode(num);
        }
        return document;
    }
    //Method to construct xml body document for checkDncForNumbers
    public static DOM.Document checkDncForNumbers(List<String> numbers) {
        DOM.Document document = new DOM.Document();
        DOM.XmlNode body = createDocumentBody(document);
        DOM.XmlNode checkDncForNumbers = body.addChildElement('checkDncForNumbers', ser, 'ser');
        // check numbers in DNC
        for(String num : numbers) {
            checkDncForNumbers.addChildElement('numbers', null, null).addTextNode(num);
        }
        return document;
    }
    //method to callout to Five9
    public static Boolean calloutToFive9(DOM.Document document, Five9_API__c five9ApiSettings,String responseName)
    {
        Boolean isSuccess;
        HttpClient httpInstance;
        HttpClient.HttpResponseWrapper responseWrapper;
        String endpoint = Five9ListService.getEndpoint(five9ApiSettings.API_URL__c);
        try {
            //Construct HTTP request
            httpInstance = Five9ListService.constructRequestWrapper(endpoint, document, five9ApiSettings);
            //Send the HTTP request and return the HTTP response wrapper
            responseWrapper = httpInstance.sendRequest();
            Integer statusCode = responseWrapper.baseResponse.getStatusCode();
            String responseMessage;
            //Get the response body xml node
            Dom.XMLNode bodyResult = Five9ListService.getBodyResult(responseWrapper.baseResponse.getbody());
            
            if (statusCode == 200) {
                isSuccess = true;
                //Parse and return the success response by traversing the child nodes
                responseMessage = Five9ListService.parseSuccessResponse(responseName, bodyResult);
                //Create a log of the callout success
                ApplicationLogger.logXMLCalloutSuccess(
                    endpoint, httpInstance.constructedRequest, responseWrapper.baseResponse, 
                    responseMessage,null
                );
            } else {
                isSuccess = false;
                //Parese and return the fault response by traversing the child nodes.
                responseMessage = Five9ListService.parseFaultResponseForAddRemoveNumbersFromDNC(bodyResult);
                //Create a log for the callout failure
                ApplicationLogger.logXMLCalloutFailure(
                    endpoint, httpInstance.constructedRequest, responseWrapper.baseResponse, 
                    responseMessage,null
                );
            } 
        }
        catch(Exception exp) { 
            //Create a log for exception
            ApplicationLogger.logCalloutException(
                endpoint, httpInstance.constructedRequest, 
                responseWrapper.baseResponse, exp, null
            );
        }
        return isSuccess;
    }
    //method to do callout for checkForDNCNumbers
    public static List<String> calloutToFive9ForDNCNumbers(DOM.Document document, Five9_API__c five9ApiSettings, String responseName) {
        List<String> returnedList = new List<String>();
        HttpClient httpInstance;
        HttpClient.HttpResponseWrapper responseWrapper;
        If(five9ApiSettings != null){ 
        String endpoint = Five9ListService.getEndpoint(five9ApiSettings.API_URL__c);
        
        try {
            // Construct HTTP request
            httpInstance = Five9ListService.constructRequestWrapper(endpoint, document, five9ApiSettings);
            // Send the HTTP request and get the response
            responseWrapper = httpInstance.sendRequest();
            
            Integer statusCode = responseWrapper.baseResponse.getStatusCode();
            String responseMessage;
            // Get the response body XML node
            Dom.XMLNode bodyResult = Five9ListService.getBodyResult(responseWrapper.baseResponse.getBody());
            
            if (statusCode == 200) {
                for (Dom.XMLNode responseNode : bodyResult.getChildElements()) {
                    if (responseNode.getName().equals('checkDncForNumbersResponse')) {
                        for (Dom.XMLNode returnNode : responseNode.getChildElements()) {
                            if (returnNode.getName().equals('return')) {
                                returnedList.add(returnNode.getText());
                            }
                        }
                    }
                }
                
                // Log successful callout
                ApplicationLogger.logXMLCalloutSuccess(
                    endpoint, httpInstance.constructedRequest, responseWrapper.baseResponse, 
                    responseMessage, null
                );
            } else {
                // Parse fault response
                responseMessage = Five9ListService.parseFaultResponseForAddRemoveNumbersFromDNC(bodyResult);
                // Log failure callout
                ApplicationLogger.logXMLCalloutFailure(
                    endpoint, httpInstance.constructedRequest, responseWrapper.baseResponse, 
                    responseMessage, null
                );
            } 
         
        } catch (Exception exp) { 
            // Log exception
            ApplicationLogger.logCalloutException(
                endpoint, httpInstance.constructedRequest, 
                responseWrapper.baseResponse, exp, null
            );
        }
       }
        return returnedList;
    }

    public static DOM.Document deleteFromFive9List(String five9ListName, Set<Id> leadIds,  Map<String, Object> fieldMappingObject) {
        DOM.Document document = new DOM.Document();
        DOM.XmlNode body = createDocumentBody(document);
        DOM.XmlNode deleteFromList =  body.addChildElement('deleteFromList', ser , 'ser');
        deleteFromList.addChildElement('listName', null, null).addTextNode(five9ListName);
        DOM.XmlNode listDeleteSettings = deleteFromList.addChildElement('listDeleteSettings', null, null);
        //Method call to create the listUpdateSettings node with its nested nodes to store Five9 configurations.
        listDeleteSettings = createListDeleteSettingsNode(listDeleteSettings, fieldMappingObject.keySet());
        DOM.XmlNode importData = deleteFromList.addChildElement('importData', null, null);
        //Method call to create the importData node with its nested nodes to store SF data.
        importData = createImportDataWithValueNodes(importData, LeadIds, fieldMappingObject.values());
        return document;
    }  
    
    private static DOM.XmlNode createListDeleteSettingsNode(DOM.XmlNode listDeleteSettings,Set<String> five9FieldNameSet){
       listDeleteSettings.addChildElement('allowDataCleanup', null, null).addTextNode('True');
        listDeleteSettings.addChildElement('countryCode', null, null).addTextNode('US');
        listDeleteSettings.addChildElement('failOnFieldParseError', null, null).addTextNode('false');
        //Method call to create nodes of five9 field names with a series of number
        listDeleteSettings = createFieldMappingNodes(listDeleteSettings, five9FieldNameSet);
        //Method call to create node for report email from the custom settings
        listDeleteSettings = createReportEmailNode(listDeleteSettings);
        listDeleteSettings.addChildElement('separator', null, null).addTextNode(',');
        listDeleteSettings.addChildElement('skipHeaderLine', null, null).addTextNode('false');
        listDeleteSettings.addChildElement('listDeleteMode',null,null).addTextNode('DELETE_ALL');
        return listDeleteSettings;
    }
    
    //Method to create ImportData node with the SF data as an item nodes
    private static DOM.XmlNode createImportDataWithValueNodes(DOM.XmlNode importData, Set<Id> leadIds, List<Object> sfFieldNames) {
        //Method call to get the set of lead Ids in the five9 list items to sync
       // Set<Id> leadIdSet = Five9ListData.getLeadIdSet(five9ListItems);
        //Construct a map to get the lead values based on the lead Id to create item node
        Map<Id, Lead> leadMap = new Map<Id, Lead>(
            LeadData.getLeadList(sfFieldNames, leadIds)
        );
            for(Lead leadInstance : leadMap.Values()){
                if (leadInstance != null && !sfFieldNames.isEmpty()) {
                    DOM.XmlNode values = importData.addChildElement('values', null, null);
                    for (Object sfFieldNameObj : sfFieldNames) {
                        //Method call to create item node based on the SF field name and SF field value
                        values = createItemNode(sfFieldNameObj, leadInstance, values);
                    }
                }
            }
        return importData;
    }
}