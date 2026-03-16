

API Overview
Used to query the current status and result information of a 3D model generation task based on the task ID.

Protocol	Endpoint	Method	Auth	Request Format	Response Format
HTTP	/open-api/v1/query-task	GET	Bearer	application/json	application/json
Request Headers
Parameter	Value	Description
Content-Type	application/json	Data exchange format
Authorization	Bearer	Replace {accessToken} with the accessToken obtained above

Authorization: Bearer <accessToken>
Content-Type: application/json

Request Parameters (HTTP GET)
Parameter	Type	Required	Description
task_id	String	Yes	Task ID returned by create task API upon success

http://api.hitem3d.com/open-api/v1/query-task?task_id=caf4562ed96540d99faf421a1722b82e.jjewelry-aigc-api.3BCRb4Wp9d
1
Response Body
Parameter	Field	Type	Description
code	-	String	Error code, see error code table
data	task_id	String	Task ID
state	String	Processing status
• Task created successfully: created
• Task queuing: queueing
• Task processing: processing
• Task successful: success
• Task failed: failed
id	String	Generated content ID, used to identify different generated items
cover_url	String	Generated content cover image URL, valid for one hour
url	String	Generated content URL, valid for one hour
msg	-	String	Detailed error message

{
    "code": 200,
    "data": {
        "task_id": "2c2ad20cb3204697ba7f80351c3e8606.jjewelry-aigc-api.1NraEb5ohU",
        "state": "success",
        "id": "2c2ad20cb3204697ba7f80351c3e8606.jjewelry-aigc-api.1NraEb5ohU_0",
        "url": "https://hitem3dstatic.zaohaowu.net/jjewelry/web/model3ds/img2model3d/20250723/b88e564c1aea4ae78dd550705d4d2fb1/target//original/0.glb",        
        "cover_url": "https://hitem3dstatic.zaohaowu.net/jjewelry/web/model3ds/img2model3d/20250820/d30769c2cd054040b7a6d8a88542e300/target/cover/webp/0.webp"
    },
    "msg": "success"
}

Error Codes
Error codes are returned in JSON structure, including code and msg fields. We will expand the corresponding field values with version updates.


{
    "code": 50010001,
    "data": {},
    "msg": "generate failed"
}

Error Code	Error Message	Error Description
50010001	generate failed	Timeout or model unable to parse image, task generation failed, please retry; consumed credits have been refunded


Request Examples (Shell & Python)
Shell


curl --location --request GET 'https://api.hitem3d.ai/open-api/v1/query-task?task_id=14fb7ecb7b3b467f80cd4bb16e4a44cd.jjewelry-aigc-merchant-api.ZCqTyPcTwV' \
--header 'Authorization: Bearer 6pzBx1a5Cj68XhQe*H07YsrAYSIuSptfihGpHd40QTd3RtfRWy-ao9F12AqYUYdedxmbL0Yl2F8HO9nbhFuIs0hhoaJAd7GUAlgfp2nbHlqTJIBphEHgw_oVAtp9VQtN-mS_uUTwUejcENG4WzwAPtTsJBIZQzGjU_xJzZvnQPPPxaSQaPEBNsekNRFzMLq8us4W3zJJa8P3G0EVnQQ1_jhO6X4ycMBKfqS8GXALZntk-4vkykA4sZxU6edoQEjKGC6oT_dRK3GzevCxI1uvYvwmsNjZYe4G7uDlkNAuny6EdDiBqb3hpf4jETA_mv5ItAJvccd5S91_IJEV0v5uBALrkuD-bDuneLIi2h6-11et4gmAA5_00XgOq8OJDcJ3LUI71Jw==*WeNzV21CwM-cyccZ8BQmfNZn3hViOpTMLg1kJQnb0WI=' \
--header 'Appid: 20009998' \
--header 'User-Agent: Apifox/1.0.0 (https://apifox.com)' \
--header 'Accept: */*' \
--header 'Host: api.hitem3d.ai' \
--header 'Connection: keep-alive'

Python


import requests

url = "https://api.hitem3d.ai/open-api/v1/query-task?task_id=14fb7ecb7b3b467f80cd4bb16e4a44cd.jjewelry-aigc-merchant-api.ZCqTyPcTwV"

payload={}
headers = {
   'Authorization': 'Bearer 6pzBx1a5Cj68XhQe*H07YsrAYSIuSptfihGpHd40QTd3RtfRWy-ao9F12AqYUYdedxmbL0Yl2F8HO9nbhFuIs0hhoaJAd7GUAlgfp2nbHlqTJIBphEHgw_oVAtp9VQtN-mS_uUTwUejcENG4WzwAPtTsJBIZQzGjU_xJzZvnQPPPxaSQaPEBNsekNRFzMLq8us4W3zJJa8P3G0EVnQQ1_jhO6X4ycMBKfqS8GXALZntk-4vkykA4sZxU6edoQEjKGC6oT_dRK3GzevCxI1uvYvwmsNjZYe4G7uDlkNAuny6EdDiBqb3hpf4jETA_mv5ItAJvccd5S91_IJEV0v5uBALrkuD-bDuneLIi2h6-11et4gmAA5_00XgOq8OJDcJ3LUI71Jw==*WeNzV21CwM-cyccZ8BQmfNZn3hViOpTMLg1kJQnb0WI=',
   'Appid': '20009998',
   'User-Agent': 'Apifox/1.0.0 (https://apifox.com)',
   'Accept': '*/*',
   'Host': 'api.hitem3d.ai',
   'Connection': 'keep-alive'
}

response = requests.request("GET", url, headers=headers, data=payload)

print(response.text)

