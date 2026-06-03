@IsTest
public class MockHttpResponseHandler implements HttpCalloutMock {

    Boolean isSuccess = true;
    String methodRequestName;

    public MockHttpResponseHandler() {}

    public MockHttpResponseHandler(Boolean isSuccess) {
        this.isSuccess = isSuccess;
    }

    public MockHttpResponseHandler(String methodName, Boolean isSuccess) {
        this.isSuccess = isSuccess;
        this.methodRequestName = methodName;
    }

    public HttpResponse respond(HttpRequest request) {
        
        HttpResponse response = new HttpResponse();

        System.debug('request---->'+request);
        System.debug('request---->'+request.getEndpoint());

        if (request.getEndpoint().contains('IP_Quality_Score')) {
            response.setStatusCode(200);
            response.setStatus('OK');
            response.setBody('{"message":"Phone is valid.","success":true,"formatted":"+18007132618","local_format":"(800) 713-2618","valid":true,"fraud_score":100,"recent_abuse":true,"VOIP":false,"prepaid":null,"risky":true,"active":true,"carrier":"SomosGov","line_type":"Toll Free","country":"US","city":"Telephone","zip_code":"75488","region":"TX","dialing_code":1,"active_status":"N/A","sms_domain":"N/A","associated_email_addresses":{"status":"No associated emails found.","emails":[]},"user_activity":"Disabled for performance. Contact support for further assistance.","mnc":"N/A","mcc":"N/A","leaked":false,"spammer":false,"request_id":"XT1aXReNFO","name":"N/A","timezone":"America/Chicago","do_not_call":false,"accurate_country_code":true,"sms_email":"N/A"}');
        } else if (request.getEndpoint().contains('click.coastaldebt.com')) {
            response.setStatusCode(200);
            response.setStatus('OK');
        } else if (request.getEndpoint().contains('info.bestmoneyrelief.com')) {
            response.setStatusCode(200);
            response.setStatus('OK');
        } else {
            if (request.getEndpoint().contains('&Method=')) {
                String methodName = request.getEndpoint().substringAfter('&Method=');
                System.debug('methodName---->'+methodName);
                if (String.isNotBlank(methodName)) {
                    response.setHeader('Content-Type', 'application/json');
                    response.setStatusCode(200);
                    response.setStatus('OK');
                    if (methodName.equals('CreateTrustAccount')) {
                        if (isSuccess) {
                            response.setBody(
                                '{"RequestID": 2248,"PrimaryKeyID": 1543,"Success": true,"Message": "Customer trust account created",'
                                +'"Records": 0,"ProcessData": null,"EchoRequest": null}'
                            );
                        }
                    } else if (methodName.equals('SetPaymentMethod')) {
                        if (isSuccess) {
                            response.setBody(
                                '{"RequestID": 26,"PrimaryKeyID": 0,"Success": true,"Message": "The payment method has been added to customer 1",'
                                +'"Records": 0,"ProcessData": null,"EchoRequest": "Form Variables:\\r\\nBankRoutingNumber = 3131234'
                                +'\\r\\nMethod = SetPaymentMethod\\r\\nBankAccountNumber = 123123\\r\\nPaymentType = ACH\\r\\nCustomerID = 1'
                                +'\\r\\nQueryString Variables:\\r\\nAPIKey = 0EA7D8F4-1485-4D73-A3BC-1EAE3253F01C\\r\\nCompanyKey = 1\\r\\nMethod = SetPaymentMethod\\r\\n"}'
                            );
                        }
                    } else if (methodName.equals('SetOneTimeDebitSchedule')) {
                        if (isSuccess) {
                            response.setBody(
                                '{"RequestID": 4261, "PrimaryKeyID": 67, "Success": true, "Message": "The debit has been scheduled", "Records": 0,"ProcessData": null}'
                            );
                        }
                    } else if (methodName.equals('UpdateCustomer')) {
                        if (isSuccess) {
                            response.setBody(
                                '{"RequestID": 2248,"PrimaryKeyID": 1547,"Success": true,"Message": "Customer trust account updated",'
                                +'"Records": 0,"ProcessData": null,"EchoRequest": null}'
                            );
                        }
                    } else if (methodName.equals('UpdateDebit')) {
                        if (isSuccess) {
                            response.setBody(
                                '{"RequestID": 4261, "Success": true, "Message": "The debit has been scheduled", "Records": 0,"ProcessData": null}'
                            );
                        }
                    } else if (methodName.equals('CreatePayeeAccount') || methodName.equals('UpdatePayee')) {
                        if (isSuccess) {
                            response.setBody(
                                '{"RequestID": 2298,"PrimaryKeyID": 1543,"Success": true,"Message": "Payee account created","Records": 0,"ProcessData": null}'
                            );
                        } else {
                            response.setBody(
                                '{"RequestID": 2298,"PrimaryKeyID": null,"Success": false,"Message": "Payee account not created","Records": 0,"ProcessData": null}'
                            );
                        }
                    } else if (methodName.equals('CancelDebit')) {
                        if (isSuccess) {
                            response.setBody(
                                '{"RequestID": 2298,"PrimaryKeyID": 972,"Success": true,"Message": "The debit has been canceled","Records": 0,"ProcessData": null}'
                            );
                        } else {
                            response.setBody(
                                '{"RequestID": 2298,"PrimaryKeyID": null,"Success": false,"Message": "The debit has already been cancelled","Records": 0,"ProcessData": null}'
                            );
                        }
                    } else if (methodName.equals('CreateDocument')) {
                        if (isSuccess) {
                            response.setBody(
                                '{"RequestID": 15069, "PrimaryKeyID": 374, "Success": true, "Message": "Customer trust agreement has been updated", "Records": 0, "ProcessData": null}'
                            );
                        } else {
                            response.setBody(
                                '{"RequestID": 15069, "PrimaryKeyID": 374, "Success": false, "Message": "Customer trust agreement has not been updated", "Records": 0, "ProcessData": null}'
                            );
                        }
                    } else if (methodName.equals('SetDebitSchedule') || methodName.equals('AddDebits') || methodName.equals('UpdateDebits') || methodName.equals('CancelDebits')) {
                        if (isSuccess) {
                            response.setBody(
                                '{"RequestID": 16494,"PrimaryKeyID": 2090,"Success": true,"Message": null,"Records": 0,"ProcessData": null,"JsonData": [{"DebitID": 14707,"Amount": 2843.26,"Date": "2024-04-29T00:00:00","Success": true,"Message": "The debit schedule line item has been added"}]}'
                            );
                        } else {
                            response.setBody(
                                '{"RequestID": 16494,"PrimaryKeyID": 2090,"Success": false,"Message": null,"Records": 0,"ProcessData": null,"JsonData": [{"DebitID": 14707,"Amount": 2843.26,"Date": "2024-04-29T00:00:00","Success": false,"Message": "The debit schedule line item has been added"}]}'
                            );
                        }
                    } else if (methodName.equals('GetUpdatedDebits')) {
                        System.debug('issucc ' + this.isSuccess);
                        if (this.isSuccess) {
                            // Build child payouts
                            List<Map<String, Object>> payouts = new List<Map<String, Object>>();
                            payouts.add(new Map<String, Object>{
                                'id' => '265272',
                                'amount' => '145.00',
                                'payees_id' => '15',
                                'debitschedules_debits_id' => '141496'
                            });
                            payouts.add(new Map<String, Object>{
                                'id' => '265273',
                                'amount' => '55.00',
                                'payees_id' => '161',
                                'debitschedules_debits_id' => '141496'
                            });

                            // Build debit rows; Payments must be a JSON string per SASApi expectations
                            List<Map<String, Object>> debits = new List<Map<String, Object>>();
                            debits.add(new Map<String, Object>{
                                'DebitID' => '141496',
                                'DebitRemoteID' => 'a0SVE000004FuIv2AK',
                                'CustomerID' => '2641',
                                'RemoteID' => '001VE00000cUl8aYAC',
                                'Total' => '2081.55',
                                'Status' => 'Pending',
                                'DebitDate' => '9/11/2025 12:00:00 AM',
                                'Reason' => 'R01: Insufficient Funds',
                                'Payments' => JSON.serialize(payouts)
                            });

                            // Construct SASWrapper.SAS_RESPONSE-shaped payload
                            Map<String, Object> finalResponseMap = new Map<String, Object>();
                            finalResponseMap.put('RequestID', '9999');
                            finalResponseMap.put('PrimaryKeyID', '0');
                            finalResponseMap.put('Success', 'true');
                            finalResponseMap.put('Message', 'Mock response with 1 row.');
                            finalResponseMap.put('Records', '1');
                            finalResponseMap.put('ProcessData', JSON.serialize(debits)); // string
                            finalResponseMap.put('JsonData', null);

                            response.setHeader('Content-Type', 'application/json');
                            response.setBody(JSON.serialize(finalResponseMap));
                            response.setStatusCode(200);
                            response.setStatus('OK');
                        } else {
                            response.setHeader('Content-Type', 'application/json');
                            response.setStatusCode(200);
                            response.setStatus('OK');
                            response.setBody('{"RequestID":"9999","PrimaryKeyID":"0","Success":"false","Message":"Mock Failure","Records":"0","ProcessData":null,"JsonData":null}');
                        }
                    } else if (methodName.equals('CloseAccount')) {
                        response.setBody('{"RequestID": 104, "PrimaryKeyID": 1, "Success": true, "Message": "The customer account has been suspended"}');
                    } else if (methodName.equals('SetSettlementSchedule') || methodName.equals('UpdatePayouts')) {
                        response.setBody('{"RequestID": 14485,"PrimaryKeyID": 2882,"Success": true,"Message": null,"Records": 0,"ProcessData": null,"JsonData": [{"PayoutID": 129381,"Amount": 180.00,"Date": "2026-02-01T00:00:00","Success": true,"Message": "The payment out has been added"}]}');
                    } else if (methodName.equals('GetCustomerRecords')) {
                        response.setBody('{"RequestID": 20657,"PrimaryKeyID": 0,"Success": true,"Message": null,"Records": 1,"ProcessData":"[{\\"id\\":1597,\\"remoteid\\":\\"001VD00000FMxK9YAL\\"}]"}');
                    } else if (methodName.equals('GetDebitSchedule')) {
                        String paymentsJson = '[{"id":307844,"payees_id":239,"amount":10000.00,"payees_remoteid":"179"},{"id":307843,"payees_id":241,"amount":850.00,"payees_remoteid":""}]';

                        List<Map<String, Object>> debitsList = new List<Map<String, Object>>();
                        debitsList.add(new Map<String, Object>{
                            'DebitID' => '174857',
                                'DebitRemoteID' => '',
                                'Total' => '10865.00',
                                'Status' => 'Pending',
                                'DebitDate' => '1/7/2026 12:00:00 AM',
                                'Payments' => paymentsJson 
                                });
                        
                        String debitsJsonString = JSON.serialize(debitsList);
                        
                        Map<String, Object> schedules0 = new Map<String, Object>{
                            'ScheduleID' => 5016,
                                'Debits' => debitsJsonString
                                };
                                    
                        Map<String, Object> processDataMap = new Map<String, Object>{
                             'Schedules0' => schedules0
                                 };                                                
                                      
                        String processDataFinalString = JSON.serialize(JSON.serialize(debitsJsonString)); 
                        
                        String processDataForReal = JSON.serialize(processDataMap);
                        
                        Map<String, Object> responseMap = new Map<String, Object>{
                            'RequestID' => 112065,
                                'PrimaryKeyID' => '0',
                                'Success' => 'true',
                                'Message' => null,
                                'Records' => 1,
                                'ProcessData' => processDataForReal 
                                };
                                    
                         response.setBody(JSON.serialize(responseMap));

                    } /*else if (methodName.equals('GetCustomerRecords')) {
                        response.setBody('{"RequestID":2912,"PrimaryKeyID":0,"Success":true,"Message":null,"Records":1,"ProcessData":"[{"id":1647,"remoteid":\"001VD00000FoLILYA3\",\"clients_id\":8,\"customerstatus_enums_id\":8,\"clients_display\":\"CoastalDebt - TEST ACCOUNT\",\"firstname\":\"Test Client\",\"lastname\":\"Jan 15\",\"company\":\"Test Company\",\"display\":\"Jan 15, Test Client (Test Company)\",\"address1\":\"Test Street\",\"address2\":\"\",\"address3\":\"\",\"address4\":\"\",\"city\":\"Clio\",\"state\":\"AL\",\"postalcode\":\"94405\",\"country\":\"United States\",\"phone1\":\"9845679845\",\"phone2\":\"\",\"phone3\":\"\",\"email\":\"sdjfghsuydf@dkfjgfdg.com\",\"dob\":\"1995-01-23T00:00:00\",\"created\":\"2025-01-15T02:47:42.99\",\"createdby\":\"API Engine\",\"modified\":\"2025-01-15T02:49:06.9\",\"modifiedby\":\"API Engine\",\"isportalactive\":true,\"isflagged\":false,\"istest\":true,\"clients_email\":\"amuppidi@yatitechnology.com\",\"clients_email2\":\"amuppidi@yatitechnology.com\",\"autosettle_payees_id\":9,\"customerstatus\":\"Active\",\"status_bg\":null,\"ssntid\":\"CjObGYzDpO75ZQpqx/R8fw==\",\"password\":\"pFdJX0imX2acfEG5DSCqGg==\",\"salt\":\"Awr4ay8g3SAoNDSPbLGXIg==\",\"totalfailed\":null,\"totaldebt\":250000.00,\"totaldebits\":186467.13,\"totalfees\":0.00,\"totalcitadel\":1015.00,\"balance\":0.00,\"balance_earmark\":0.00,\"rownumber\":1}]","JsonData":null,"EchoRequest":"Form Variables:\r\nQueryString Variables:\r\nAPIKey = 12801d1f-9f8a-4827-88e3-1b08eec15edc\r\nCompanyKey = 8\r\nMethod = GetCustomerRecords\r\nParams: \r\n{\"RemoteID\":\"001VD00000FoLILYA3\"}"}');
                    } else if (methodName.equals('GetDebitSchedule')) {
                        response.setBody('{"RequestID":2913,"PrimaryKeyID":0,"Success":true,"Message":null,"Records":0,"ProcessData":"{\"Schedules0\":{\"ScheduleID\":3453,\"Name\":\"Debit Schedule 20251501\",\"CreatedDate\":\"2025-01-15T02:47:44.51\",\"CreatedBy\":\"API Engine\",\"Debits\":{\"Debit0\":{\"DebitID\":81823,\"DebitRemoteID\":\"a0SVD000000j2qT2AQ\",\"Amount\":25851.00,\"DebitDate\":\"2025-01-16T00:00:00\",\"Status\":\"Pending\"}},\"Payouts\":{\"Payment0\":{\"PayoutID\":145719,\"PayeeID\":16,\"RemoteID\":\"\",\"Amount\":850.00,\"PaymentsOutID\":null},\"Payment1\":{\"PayoutID\":145718,\"PayeeID\":16,\"RemoteID\":\"\",\"Amount\":25001.00,\"PaymentsOutID\":null}}}}"}');
                    }*/
                }
            } else if (this.methodRequestName != null && String.isNotBlank(this.methodRequestName)) {
                if (isSuccess) {
                    response.setHeader('Content-Type', 'text/xml;charset=UTF-8');
                    response.setStatusCode(200);
                    response.setStatus('OK');
                } else {
                    response.setStatusCode(500);
                }

                Dom.Document domDoc = request.getBodyDocument();

                if(methodRequestName.equals('addToList')){
                    String addToListResponse_Success = 
                '<?xml version=\'1.0\' encoding=\'UTF-8\'?>'+
                '<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">'+
                    '<env:Header/>'+
                    '<env:Body>'+
                        '<ns2:addToListResponse xmlns:ns2="http://service.admin.ws.five9.com/">'+
                            '<return>'+
                                '<identifier>47f66e53-9fe2-4a8c-aaf0-5bf9837084e6</identifier>'+
                            '</return>'+
                        '</ns2:addToListResponse>'+
                    '</env:Body>'+
                '</env:Envelope>';

                String addToListResponse_Failure = 
                '<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">'+
                    '<env:Header/>'+
                    '<env:Body>'+
                        '<env:Fault>'+
                            '<faultcode>env:Server</faultcode>'+
                            '<faultstring>Number +1 206-619-1863 is not correctly formatted.</faultstring>'+
                            '<detail>'+
                                '<ns1:IncorrectArgumentFault xmlns:ns1="http://service.admin.ws.five9.com/">'+
                                    '<message>Number +1 206-619-1863 is not correctly formatted.</message>'+
                                '</ns1:IncorrectArgumentFault>'+
                            '</detail>'+
                        '</env:Fault>'+
                    '</env:Body>'+
                '</env:Envelope>';
                
                    if (isSuccess && this.methodRequestName.equals('addToList')) {
                        response.setBody(addToListResponse_Success);
                    } else if (!isSuccess && this.methodRequestName.equals('addToList')) {
                        response.setBody(addToListResponse_Failure);
                    }
                }
                if(methodRequestName.equals('addNumbersToDNC')){
                    String addNumbersToDNC_Success   =  
                        '<?xml version="1.0" encoding="utf-8"?>'+
                        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'+
                        '<soap:Body>'+
                        '<addNumbersToDncResponse xmlns="http://service.admin.ws.five9.com/">'+
                        '<return>0</return>'+
                        '</addNumbersToDncResponse>'+
                        '</soap:Body>'+
                        '</soap:Envelope>';
                    String addNumbersToDNC_Failure = 
                        '<?xml version="1.0" encoding="utf-8"?>'+
                        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'+
                        '<soap:Body>'+
                        '<MissedArgumentFault xmlns="http://service.admin.ws.five9.com/">'+
                        '<message>string</message>'+
                        '</MissedArgumentFault>'+
                        '</soap:Body>'+
                        '</soap:Envelope>';
                    if (isSuccess && this.methodRequestName.equals('addNumbersToDNC')) {
                        response.setBody(addNumbersToDNC_Success);
                    }
                    else if (!isSuccess && this.methodRequestName.equals('addNumbersToDNC')) {
                        response.setBody(addNumbersToDNC_Failure);
                    }
                }
                if(methodRequestName.equals('removeNumbersFromDNC')){
                    String removeNumbersFromDNC_Success   =  
                        '<?xml version="1.0" encoding="utf-8"?>'+
                        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'+
                        '<soap:Body>'+
                        '<removeNumbersFromDncResponse xmlns="http://service.admin.ws.five9.com/">'+
                        '<return>100</return>'+
                        '</removeNumbersFromDncResponse>'+
                        '</soap:Body>'+
                        '</soap:Envelope>';
                    String removeNumbersFromDNC_Failure = 
                        '<?xml version="1.0" encoding="utf-8"?>'+
                        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'+
                        '<soap:Body>'+
                        '<MissedArgumentFault xmlns="http://service.admin.ws.five9.com/">'+
                        '<message>string</message>'+
                        '</MissedArgumentFault>'+
                        '</soap:Body>'+
                        '</soap:Envelope>';
                    if (isSuccess && this.methodRequestName.equals('removeNumbersFromDNC')) {
                        response.setBody(removeNumbersFromDNC_Success);
                    }
                    else if (!isSuccess && this.methodRequestName.equals('removeNumbersFromDNC')) {
                        response.setBody(removeNumbersFromDNC_Failure);
                    }
                }
                if(methodRequestName.equals('checkDncForNumbers')){
                    String checkDncForNumbers_Success   =  
                        '<?xml version="1.0" encoding="utf-8"?>'+
                        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'+
                        '<soap:Body>'+
                        '<checkDncForNumbersResponse xmlns="http://service.admin.ws.five9.com/">'+
                        '<return>9876054321</return>'+
                        '</checkDncForNumbersResponse>'+
                        '</soap:Body>'+
                        '</soap:Envelope>';
                    String checkDncForNumbers_Failure = 
                        '<?xml version="1.0" encoding="utf-8"?>'+
                        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'+
                        '<soap:Body>'+
                        '<MissedArgumentFault xmlns="http://service.admin.ws.five9.com/">'+
                        '<message>string</message>'+
                        '</MissedArgumentFault>'+
                        '</soap:Body>'+
                        '</soap:Envelope>';
                    if (isSuccess && this.methodRequestName.equals('checkDncForNumbers')) {
                        response.setBody(checkDncForNumbers_Success);
                    }
                    else if (!isSuccess && this.methodRequestName.equals('checkDncForNumbers')) {
                        response.setBody(checkDncForNumbers_Failure);
                    }
                }
                 if(methodRequestName.equals('deleteFromFive9List')){
                String deleteFromListResponse_Success = 
            '<?xml version=\'1.0\' encoding=\'UTF-8\'?>'+
            '<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">'+
                '<env:Header/>'+
                '<env:Body>'+
                    '<ns2:deleteFromListResponse xmlns:ns2="http://service.admin.ws.five9.com/">'+
                        '<return>'+
                            '<identifier>47f66e53-9fe2-4a8c-aaf0-5bf9837084e6</identifier>'+
                        '</return>'+
                    '</ns2:deleteFromListResponse>'+
                '</env:Body>'+
            '</env:Envelope>';

            String deleteFromListResponse_Failure = 
            '<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">'+
                '<env:Header/>'+
                '<env:Body>'+
                    '<env:Fault>'+
                        '<faultcode>env:Server</faultcode>'+
                        '<faultstring>Number +1 206-619-1863 is not correctly formatted.</faultstring>'+
                        '<detail>'+
                            '<ns1:IncorrectArgumentFault xmlns:ns1="http://service.admin.ws.five9.com/">'+
                                '<message>Number +1 206-619-1863 is not correctly formatted.</message>'+
                            '</ns1:IncorrectArgumentFault>'+
                        '</detail>'+
                    '</env:Fault>'+
                '</env:Body>'+
            '</env:Envelope>';
            
                if (isSuccess && this.methodRequestName.equals('deleteFromFive9List')) {
                    response.setBody(deleteFromListResponse_Success);
                } else if (!isSuccess && this.methodRequestName.equals('deleteFromFive9List')) {
                    response.setBody(deleteFromListResponse_Failure);
                }
              }
            }
        }
        return response;
    }
}