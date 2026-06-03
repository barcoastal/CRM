@IsTest
public class RAMMockHttpResponseHandler implements HttpCalloutMock {

    Boolean isSuccess = true;

    public RAMMockHttpResponseHandler() {}

    public RAMMockHttpResponseHandler(Boolean isSuccess) {
        this.isSuccess = isSuccess;
    }

    public HttpResponse respond(HttpRequest request) {
        HttpResponse response = new HttpResponse();
        if (isSuccess) {
            response.setStatusCode(200);
            response.setStatus('OK');
        } else {
            response.setStatusCode(500);
        }
        Dom.Document domDoc = request.getBodyDocument();
        String getSessionIdResponse =
        '<?xml version="1.0" encoding="utf-8"?>' +
            '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">' +
                '<soap:Body>' +
                    '<StartSessionResponse xmlns="http://www.ramservicing.com/">' +
                    '<StartSessionResult>671ad5d1-f717-4fa1-826d-5d0cf6bca579</StartSessionResult>' +
                '</StartSessionResponse>' +
            '</soap:Body>' +
        '</soap:Envelope>';
        String endSessionIdResponse =
        '<?xml version="1.0" encoding="utf-8"?>' +
        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">' +
            '<soap:Body>' +
                '<EndSessionResponse xmlns="http://www.ramservicing.com/">' +
                    '<EndSessionResult>OK</EndSessionResult>' +
                '</EndSessionResponse>' +
            '</soap:Body>' +
        '</soap:Envelope>';
        String endSessionIdFaultResponse = 
        '<?xml version="1.0" encoding="utf-8"?>' +
        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">' +
            '<soap:Body>' +
                '<soap:Fault>' +
                    '<faultcode>soap:Client</faultcode>' +
                    '<faultstring>Invalid Session ID</faultstring>' +
                    '<faultactor>https://staging.reliantpayment.com/Services/RAMSGatewayver2.asmx</faultactor>' +
                    '<detail>' +
                        '<SeverityLevel xmlns="http://www.ramservicing.com/">Error</SeverityLevel>' +
                    '</detail>' +
                '</soap:Fault>' +
            '</soap:Body>' +
        '</soap:Envelope>';
        String createClientIdResponse =
        '<?xml version="1.0" encoding="utf-8"?>' +
        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">' +
            '<soap:Body>' +
                '<NewClientResponse xmlns="http://www.ramservicing.com/">' +
                    '<NewClientResult>' +
                        '<string>OK</string>' +
                        '<string>Testing</string>' +
                        '<string>d4TNi5s8</string>' +
                    '</NewClientResult>' +
                '</NewClientResponse>' +
            '</soap:Body>' +
        '</soap:Envelope>';
        String createClientIdFaultResponse = 
        '<?xml version="1.0" encoding="utf-8"?>' +
        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">' +
            '<soap:Body>' +
                '<soap:Fault>' +
                    '<faultcode>soap:Client</faultcode>' +
                    '<faultstring>There is already a user account set up for this account number.</faultstring>' +
                    '<faultactor>https://staging.reliantpayment.com/Services/RAMSGatewayver2.asmx</faultactor>' +
                    '<detail>' +
                        '<SeverityLevel xmlns="http://www.ramservicing.com/">Error</SeverityLevel>' +
                    '</detail>' +
                '</soap:Fault>' +
            '</soap:Body>' +
        '</soap:Envelope>';
        String updateClientIdResponse =
        '<?xml version="1.0" encoding="utf-8"?>' +
        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">' +
            '<soap:Body>' +
                '<UpdateClientResponse xmlns="http://www.ramservicing.com/">' +
                    '<UpdateClientResult>OK</UpdateClientResult>' +
                '</UpdateClientResponse>' +
            '</soap:Body>' +
        '</soap:Envelope>';
        String updateClientIdFaultResponse = 
        '<?xml version="1.0" encoding="utf-8"?>' +
        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">' +
            '<soap:Body>' +
                '<soap:Fault>' +
                    '<faultcode>soap:Client</faultcode>' +
                    '<faultstring>Server was unable to read request. ---&gt; There is an error in XML document (6, 34). ---&gt; Input string was not in a correct format.</faultstring>' +
                    '<detail />' +
                '</soap:Fault>' +
            '</soap:Body>' +
        '</soap:Envelope>';
        String addBankAccountResponse =
        '<?xml version="1.0" encoding="utf-8"?>' +
        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">' +
            '<soap:Body>' +
                '<AddUpdateClientBankingResponse xmlns="http://www.ramservicing.com/">' +
                    '<AddUpdateClientBankingResult>OK</AddUpdateClientBankingResult>' +
                '</AddUpdateClientBankingResponse>' +
            '</soap:Body>' +
        '</soap:Envelope>';
        String addBankAccountFaultResponse = 
        '<?xml version="1.0" encoding="utf-8"?>' +
        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">' +
            '<soap:Body>' +
                '<soap:Fault>' +
                    '<faultcode>soap:Client</faultcode>' +
                    '<faultstring>Routing must be 9 characters.</faultstring>' +
                    '<faultactor>https://staging.reliantpayment.com/Services/RAMSGatewayver2.asmx</faultactor>' +
                    '<detail>' +
                        '<SeverityLevel xmlns="http://www.ramservicing.com/">Error</SeverityLevel>' +
                    '</detail>' +
                '</soap:Fault>' +
            '</soap:Body>' +
        '</soap:Envelope>';
        String createDraftPaymentResponse = 
        '<?xml version="1.0" encoding="utf-8"?>' +
        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">' +
            '<soap:Body>' +
                '<PayScheduleAddSingleResponse xmlns="http://www.ramservicing.com/">' +
                    '<PayScheduleAddSingleResult>' +
                        '<string>OK</string>' +
                        '<string>16956609</string>' +
                        '<string>117</string>' +
                    '</PayScheduleAddSingleResult>' +
                '</PayScheduleAddSingleResponse>' +
            '</soap:Body>' +
        '</soap:Envelope>';
        String createDraftPaymentFaultResponse = 
        '<?xml version="1.0" encoding="utf-8"?>' +
        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">' +
            '<soap:Body>' +
                '<soap:Fault>' +
                    '<faultcode>soap:Client</faultcode>' +
                    '<faultstring>TotalPaymentAmount does not match the fees plus savings.</faultstring>' +
                    '<faultactor>https://staging.reliantpayment.com/Services/RAMSGatewayver2.asmx</faultactor>' +
                    '<detail>' +
                        '<SeverityLevel xmlns="http://www.ramservicing.com/">Error</SeverityLevel>' +
                    '</detail>' +
                '</soap:Fault>' +
            '</soap:Body>' +
        '</soap:Envelope>';

        String updateDraftPaymentResponse = 
        '<?xml version="1.0" encoding="utf-8"?>' +
        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">' +
            '<soap:Body>' +
                '<PayScheduleUpdateSingleResponse xmlns="http://www.ramservicing.com/">' +
                    '<PayScheduleUpdateSingleResult>' +
                        '<string>OK</string>' +
                        '<string>135.95</string>' +
                    '</PayScheduleUpdateSingleResult>' +
                '</PayScheduleUpdateSingleResponse>' +
            '</soap:Body>' +
        '</soap:Envelope>';

        String updateDraftPaymentFaultResponse = 
        '<?xml version="1.0" encoding="utf-8"?>' +
        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">' +
            '<soap:Body>' +
                '<soap:Fault>' +
                    '<faultcode>soap:Client</faultcode>' +
                    '<faultstring>The discrete amounts provided do not total to the TotalPaymentAmount</faultstring>' +
                    '<faultactor>https://staging.reliantpayment.com/Services/RAMSGatewayver2.asmx</faultactor>' +
                    '<detail>' +
                        '<SeverityLevel xmlns="http://www.ramservicing.com/">Error</SeverityLevel>' +
                    '</detail>' +
                '</soap:Fault>' +
            '</soap:Body>' +
        '</soap:Envelope>';

        String getClientSavings = 
        '<?xml version="1.0" encoding="utf-8"?>'+
        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">'+
            '<soap:Body>'+
                '<GetClientSavingsResponse xmlns="http://www.ramservicing.com/">'+
                    '<GetClientSavingsResult>'+
                        '<double>0</double>'+
                        '<double>0</double>'+
                        '<double>0</double>'+
                    '</GetClientSavingsResult>'+
                '</GetClientSavingsResponse>'+
            '</soap:Body>'+
        '</soap:Envelope>';
        
        String getUpdatedSavings = 
        '<?xml version="1.0" encoding="utf-8"?>'+
        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">'+
            '<soap:Body>'+
                '<GetUpdatedSavingsResponse xmlns="http://www.ramservicing.com/">'+
                    '<GetUpdatedSavingsResult>'+
                        '<xs:schema id="NewDataSet" xmlns="" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:msdata="urn:schemas-microsoft-com:xml-msdata">'+
                            '<xs:element name="NewDataSet" msdata:IsDataSet="true" msdata:MainDataTable="Table" msdata:UseCurrentLocale="true">'+
                                '<xs:complexType>'+
                                    '<xs:choice minOccurs="0" maxOccurs="unbounded">'+
                                        '<xs:element name="Table">'+
                                            '<xs:complexType>'+
                                                '<xs:sequence>'+
                                                    '<xs:element name="vendoraccountnumber" type="xs:string" minOccurs="0" />'+
                                                    '<xs:element name="balancedate" type="xs:dateTime" minOccurs="0" />'+
                                                    '<xs:element name="balance" type="xs:decimal" minOccurs="0" />'+
                                                    '<xs:element name="feebalance" type="xs:decimal" minOccurs="0" />'+
                                                    '<xs:element name="pendingbalance" type="xs:decimal" minOccurs="0" />'+
                                                    '<xs:element name="userid" msdata:DataType="System.Guid, mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089" type="xs:string" minOccurs="0" />'+
                                                '</xs:sequence>'+
                                            '</xs:complexType>'+
                                        '</xs:element>'+
                                    '</xs:choice>'+
                                '</xs:complexType>'+
                            '</xs:element>'+
                        '</xs:schema>'+
                        '<diffgr:diffgram xmlns:msdata="urn:schemas-microsoft-com:xml-msdata" xmlns:diffgr="urn:schemas-microsoft-com:xml-diffgram-v1">'+
                            '<NewDataSet xmlns="">'+
                                '<Table diffgr:id="Table1" msdata:rowOrder="0">'+
                                    '<vendoraccountnumber>51369</vendoraccountnumber>'+
                                    '<balancedate>2025-12-25T17:47:01.423-08:00</balancedate>'+
                                    '<balance>257.6400</balance>'+
                                    '<feebalance>0.0000</feebalance>'+
                                    '<pendingbalance>0.0000</pendingbalance>'+
                                    '<userid>f6c2b5c6-2e6e-427d-acc7-550f443c8f50</userid>'+
                                '</Table>'+
                                 '<Table diffgr:id="Table2" msdata:rowOrder="1">'+
                                    '<vendoraccountnumber>75269</vendoraccountnumber>'+
                                    '<balancedate>2025-12-25T17:47:01.423-08:00</balancedate>'+
                                    '<balance>48177.0300</balance>'+
                                    '<feebalance>0.0000</feebalance>'+
                                    '<pendingbalance>0.0000</pendingbalance>'+
                                    '<userid>177cfb84-da8b-4fe0-99f9-cd4ee24acf09</userid>'+
                                '</Table>'+
                            '</NewDataSet>'+
                        '</diffgr:diffgram>'+
                    '</GetUpdatedSavingsResult>'+
                '</GetUpdatedSavingsResponse>'+
            '</soap:Body>'+
        '</soap:Envelope>';
        
        String getClientTransaction = '<?xml version="1.0" encoding="utf-8"?>'+
            '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">'+
                '<soap:Body>'+
                    '<GetClientTransactionsByUpdateDateResponse xmlns="http://www.ramservicing.com/">'+
                        '<GetClientTransactionsByUpdateDateResult>'+
                            '<xs:schema id="NewDataSet" xmlns="" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:msdata="urn:schemas-microsoft-com:xml-msdata">'+
                                '<xs:element name="NewDataSet" msdata:IsDataSet="true" msdata:MainDataTable="table1" msdata:UseCurrentLocale="true">'+
                                    '<xs:complexType>'+
                                        '<xs:choice minOccurs="0" maxOccurs="unbounded">'+
                                            '<xs:element name="table1">'+
                                                '<xs:complexType>'+
                                                    '<xs:sequence>'+
                                                        '<xs:element name="id" type="xs:int" minOccurs="0" />'+
                                                        '<xs:element name="clid" type="xs:int" minOccurs="0" />'+
                                                        '<xs:element name="action" type="xs:string" minOccurs="0" />'+
                                                        '<xs:element name="ach" type="xs:string" minOccurs="0" />'+
                                                        '<xs:element name="status" type="xs:string" minOccurs="0" />'+
                                                        '<xs:element name="notes" type="xs:string" minOccurs="0" />'+
                                                        '<xs:element name="paymentdate" type="xs:dateTime" minOccurs="0" />'+
                                                        '<xs:element name="postdate" type="xs:dateTime" minOccurs="0" />'+
                                                        '<xs:element name="amount" type="xs:double" minOccurs="0" />'+
                                                        '<xs:element name="paymentscheduleid" type="xs:int" minOccurs="0" />'+
                                                        '<xs:element name="payee" type="xs:string" minOccurs="0" />'+
                                                        '<xs:element name="ramSettlementID" type="xs:int" minOccurs="0" />'+
                                                        '<xs:element name="extendedSettlementID" type="xs:string" minOccurs="0" />'+
                                                        '<xs:element name="requestID" type="xs:string" minOccurs="0" />'+
                                                        '<xs:element name="account" type="xs:string" minOccurs="0" />'+
                                                        '<xs:element name="feename" type="xs:string" minOccurs="0" />'+
                                                        '<xs:element name="TCode" type="xs:string" minOccurs="0" />'+
                                                        '<xs:element name="TSubCode" type="xs:int" minOccurs="0" />'+
                                                        '<xs:element name="TSubSubCode" type="xs:string" minOccurs="0" />'+
                                                        '<xs:element name="ClearDate" type="xs:string" minOccurs="0" />'+
                                                        '<xs:element name="ProcessorID" type="xs:string" minOccurs="0" />'+
                                                    '</xs:sequence>'+
                                                '</xs:complexType>'+
                                            '</xs:element>'+
                                        '</xs:choice>'+
                                    '</xs:complexType>'+
                                '</xs:element>'+
                            '</xs:schema>'+
                            '<diffgr:diffgram xmlns:msdata="urn:schemas-microsoft-com:xml-msdata" xmlns:diffgr="urn:schemas-microsoft-com:xml-diffgram-v1">'+
                                '<DocumentElement xmlns="">'+
                                    '<table1 diffgr:id="table11" msdata:rowOrder="0" diffgr:hasChanges="inserted">'+
                                        '<id>63423824</id>'+
                                        '<clid>75596</clid>'+
                                        '<action>DEPOSIT</action>'+
                                        '<ach>ACH</ach>'+
                                        '<status>POSTED</status>'+
                                        '<notes />'+
                                        '<paymentdate>2025-12-31T13:32:14-08:00</paymentdate>'+
                                        '<postdate>2026-01-05T13:32:14-08:00</postdate>'+
                                        '<amount>870.37</amount>'+
                                        '<paymentscheduleid>19918657</paymentscheduleid>'+
                                        '<payee>Joshua Hoadley</payee>'+
                                        '<ramSettlementID>0</ramSettlementID>'+
                                        '<extendedSettlementID>0</extendedSettlementID>'+
                                        '<requestID>0</requestID>'+
                                        '<account>223037513</account>'+
                                        '<feename />'+
                                        '<TCode>D</TCode>'+
                                        '<TSubCode>2</TSubCode>'+
                                        '<TSubSubCode />'+
                                        '<ClearDate />'+
                                        '<ProcessorID>19918657</ProcessorID>'+
                                    '</table1>'+
                                '</DocumentElement>'+
                            '</diffgr:diffgram>'+
                        '</GetClientTransactionsByUpdateDateResult>'+
                    '</GetClientTransactionsByUpdateDateResponse>'+
                '</soap:Body>'+
            '</soap:Envelope>';
        
        if (request.getHeader('Method') != null) {
            String methodName = request.getHeader('Method');
            if (String.isNotBlank(methodName)) {
                if (methodName.equals('CreateClient') && isSuccess) {
                    response.setBody(createClientIdResponse);
                } else if (methodName.equals('UpdateClient') && isSuccess) {
                    response.setBody(updateClientIdResponse);
                } else if (methodName.equals('AddUpdateBankAccount') && isSuccess) {
                    response.setBody(addBankAccountResponse);
                } else if (methodName.equals('GetSessionId')) {
                    response.setBody(getSessionIdResponse);
                }else if (methodName.equals('GetClientSavings')) {
                    response.setBody(getClientSavings);
                } else if (methodName.equals('EndSessionId') && isSuccess) {
                    response.setBody(endSessionIdResponse);
                } else if (methodName.equals('CreateDraftAndFees') && isSuccess) {
                    response.setBody(createDraftPaymentResponse);
                } else if (methodName.equals('UpdateDraftAndFees') && isSuccess) {
                    response.setBody(updateDraftPaymentResponse);
                } else if (methodName.equals('CreateClient') && !isSuccess) {
                    response.setBody(createClientIdFaultResponse);
                } else if (methodName.equals('UpdateClient') && !isSuccess) {
                    response.setBody(updateClientIdFaultResponse);
                } else if (methodName.equals('AddUpdateBankAccount') && !isSuccess) {
                    response.setBody(addBankAccountFaultResponse);
                } else if (methodName.equals('EndSessionId') && !isSuccess) {
                    response.setBody(endSessionIdFaultResponse);
                } else if (methodName.equals('CreateDraftAndFees') && !isSuccess) {
                    response.setBody(createDraftPaymentFaultResponse);
                } else if (methodName.equals('UpdateDraftAndFees') && !isSuccess) {
                    response.setBody(updateDraftPaymentFaultResponse);
                }else if (methodName.equals('GetUpdatedSavings') && isSuccess) {
                    response.setBody(getUpdatedSavings);
                }else if (methodName.equals('GetClientTransactionsByUpdateDate') && isSuccess) {
                    response.setBody(getClientTransaction);
                }

            }
        }
        return response;
    }
}