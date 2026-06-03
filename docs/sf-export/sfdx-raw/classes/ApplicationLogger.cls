/**
 * @Description: Class to publish the application logs platform event to store the success and failure results.
 */
public with sharing class ApplicationLogger {

    public static final String SEVERITY_HIGH = 'High';

    private static List<Application_Event__e> applicationEventLogs = new List<Application_Event__e>();
    
    /**
     * @description: Method to publish the Application Log platform event to create Application logs
     */
    private static void log(String calloutEndPoint, String calloutRequest, String calloutResponse, 
        String exceptionMessage, String exceptionStackTrace, String statement, 
        String recordId, String logType, String severity
    ) {
        Application_Event__e event = constructLogInstance(calloutEndPoint, calloutRequest, calloutResponse, 
            exceptionMessage, exceptionStackTrace, statement, recordId, logType, severity
        );
        Eventbus.publish(event);
    }

    /**
     * @description: Method to create the Application Log platform event instance and store in a list
     * @returnType: Application_Event__e - An Application Event platform event instance
    */
    private static void createLogInstance(String calloutEndPoint, String calloutRequest, String calloutResponse, 
        String exceptionMessage, String exceptionStackTrace, String statement, 
        String recordId, String logType, String severity
    ) {
        Application_Event__e event = constructLogInstance(calloutEndPoint, calloutRequest, calloutResponse, 
            exceptionMessage, exceptionStackTrace, statement, recordId, logType, severity
        );
        applicationEventLogs.add(event);
    }

    /**
     * @description: Method to create the Application Log platform event instance
     * @returnType: Application_Event__e - An Application Event platform event instance
    */
    private static Application_Event__e constructLogInstance(String calloutEndPoint, String calloutRequest, 
        String calloutResponse, String exceptionMessage, String exceptionStackTrace, 
        String statement, String recordId, String logType, String severity
    ) {
        Application_Event__e event = new Application_Event__e(); 
        event.Callout_End_Point__c = calloutEndPoint; 
        event.Callout_Request__c = calloutRequest; 
        event.Callout_Response__c  = calloutResponse; 
        event.Exception_Message__c = (String.isNotBlank(exceptionMessage) && exceptionMessage.length() > 255) ? exceptionMessage.substring(0,255) : exceptionMessage; 
        event.Exception_StackTrace__c = exceptionStackTrace; 
        event.Record_Id__c = recordId; 
        event.Log_Type__c = logType; 
        event.Statement__c = statement;
        event.Severity__c = severity;
        return event;
    }

    public static void logException(Exception applicationException, String recordId){
        log(null, null, null, applicationException.getMessage(), applicationException.getStackTraceString(), null, recordId, 'Error', 'High');
    }

    public static void logException(Exception applicationException, String recordId, String statement, String severity) {
        log(null, null, null, applicationException.getMessage(), applicationException.getStackTraceString(), statement, recordId, 'Error', severity);
    }

    public static void logCalloutException(String calloutEndPoint, HttpRequest calloutRequest, HttpResponse calloutResponse, Exception calloutException, String recordId ){
        log(calloutEndPoint, String.valueOf(calloutRequest), String.valueOf(calloutResponse), calloutException.getMessage(), calloutException.getStackTraceString(), null, recordId, 'Error', null);
    }

    public static void logCalloutSuccess(String calloutEndPoint, HttpRequest calloutRequest, HttpResponse calloutResponse, String statement, String recordId){
        Integer maxLength = 10000;
        if(statement == 'Callout request sent to Citadel' && calloutRequest != null && calloutRequest.getBody().length() > maxLength){
            String requiredReq = calloutRequest.getBody().substring(0, maxLength);
            log(calloutEndPoint, requiredReq, (calloutResponse != null ? calloutResponse.getBody() : null), null, null, statement, recordId, 'Callout Success', null); 
        }else{
            log(calloutEndPoint, (calloutRequest != null ? calloutRequest.getBody() : null), (calloutResponse != null ? calloutResponse.getBody() : null), null, null, statement, recordId, 'Callout Success', null);  
        }         
    }

    public static void logCalloutFailure(String calloutEndPoint, HttpRequest calloutRequest, HttpResponse calloutResponse, String exceptionMessage, String recordId){
        log(calloutEndPoint, (calloutRequest != null ? calloutRequest.getBody() : null), (calloutResponse != null ? calloutResponse.getBody() : null), exceptionMessage, null, null, recordId, 'Callout Failure', null); 
    }

    //Added success Instance
    public static void createCalloutSuccessInstance(String calloutEndPoint, HttpRequest calloutRequest, HttpResponse calloutResponse, String statement, String recordId){
        Integer maxLength = 10000;
        if(statement == 'Callout request sent to Citadel' && calloutRequest != null && calloutRequest.getBody().length() > maxLength){
            String requiredReq = calloutRequest.getBody().substring(0, maxLength);
            createLogInstance(calloutEndPoint, requiredReq, (calloutResponse != null ? calloutResponse.getBody() : null), null, null, statement, recordId, 'Callout Success', null); 
        }else{
            createLogInstance(calloutEndPoint, (calloutRequest != null ? calloutRequest.getBody() : null), ('Response Status Code: ' + calloutResponse.getStatusCode() + '; Response Body: ' + (calloutResponse != null ? calloutResponse.getBody() : null)), null, null, statement, recordId, 'Callout Success', null);  
        }         
    }
    
    //Added failure Instance
    public static void createCalloutFailureInstance(String calloutEndPoint, HttpRequest calloutRequest, HttpResponse calloutResponse, String statement, String recordId){
        createLogInstance(calloutEndPoint, (calloutRequest != null ? calloutRequest.getBody() : null), ('Response Status Code: ' + calloutResponse.getStatusCode() + '; Response Body: ' + (calloutResponse != null ? calloutResponse.getBody() : null)), null, null, statement, recordId, 'Callout Failure', null); 
    }

    public static void logXMLCalloutSuccess(String calloutEndPoint, HttpRequest calloutRequest, HttpResponse calloutResponse, String statement, String recordId){
        log(calloutEndPoint, calloutRequest.getBodyDocument().toXmlString(), calloutResponse.getBody(), null, null, statement, recordId, 'Callout Success', null); 
    }
    public static void logXMLCalloutFailure(String calloutEndPoint, HttpRequest calloutRequest, HttpResponse calloutResponse, String exceptionMessage, String recordId){
        log(calloutEndPoint, calloutRequest.getBodyDocument().toXmlString(), calloutResponse.getBody(), exceptionMessage, null, null, recordId, 'Callout Failure', null); 
    }
    
    public static void logDMLException(String statement, String recordId, String exceptionMessage, Boolean storeLog) {
        createLogInstance(null, null, null, exceptionMessage, null, statement, recordId, 'Error', null);
    }

    public static void logException(String statement, String recordId, String exceptionMessage) {
        createLogInstance(null, null, null, exceptionMessage, null, statement, recordId, 'Error', null);
    }
    
    public static void logException(String statement,String calloutRequest,String recordId, String exceptionMessage) {
        createLogInstance(null, calloutRequest, null, exceptionMessage, null, statement, recordId, 'Error', null);
    }

    public static void logDetails(String statement, String recordId, String details) {
        createLogInstance(null, null, null, details, null, statement, recordId, 'Info', 'Low');
    }

    public static void logDMLException(String statement, String recordId, String exceptionMessage){
        log(null, null, null, exceptionMessage, null, statement, recordId, 'Error', null); 
    }

    public static void logDebugInfo(String debugMessage, String recordId){
        log(null, null, null, null, null, debugMessage, recordId,  'Debug', null);
    }

    public static void logExceptionWithData(Exception applicationException, String recordId, String data, String severity){
        /* Data will be stored in callout request text area field. */
        log(null, data, null, applicationException.getMessage(), applicationException.getStackTraceString(), null, recordId, 'Error', severity);
    }
    
    public static void logExceptionWithData(Exception applicationException, String recordId,String statment, String data, String severity){
        /* Data will be stored in callout request text area field. */
        log(null, data, null, applicationException.getMessage(), applicationException.getStackTraceString(), statment, recordId, 'Error', severity);
    }

    public static void logNotificationWithData(String data, String errorMessage, String recordId, String severity){
        /* Data will be stored in callout request text area field. */
        log(null, data, null, errorMessage, null, null, recordId, 'Warning', severity);
    }

    public static void logInfoLog(String data, String message, String recordId) {
        log(null, data, null, null, null, message, recordId, 'Info', null);
    }

    public static void logInfoLog(String calloutEndpoint, String data, String message, String recordId) {
        log(calloutEndpoint, data, null, null, null, message, recordId, 'Info', null);
    }

    public static void logInfoLog(String calloutEndpoint, String data, String message, String recordId,String exceptionStackTrace) {
        log(calloutEndpoint, data, null, null, exceptionStackTrace, message, recordId, 'Info', null);
    }

    public static void logCalloutSuccessWithRequiredResponse(String calloutEndPoint, HttpRequest calloutRequest, String calloutResponse, String statement, String recordId){
        log(calloutEndPoint, (calloutRequest != null ? calloutRequest.getBody() : null), (calloutResponse != null ? calloutResponse : null), null, null, statement, recordId, 'Callout Success', null); 
    }

    public static void logExceptionHighSeverity(String statement, String recordId, String exceptionMessage) {
        log(null, null, null, exceptionMessage, null, statement, recordId, 'Error', 'High');
    }

    public static void logErrorWithSeverity(String calloutEndpoint, String message, String recordId, String severity) {
        log(calloutEndpoint, null, null, null, null, message, recordId, 'Error', severity);
    }

    public static void insertStoredLogs() {
        if (!applicationEventLogs.isEmpty()) {
            Eventbus.publish(applicationEventLogs);
        }
        applicationEventLogs.clear();
    }
}