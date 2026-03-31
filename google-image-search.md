## USING THE SEARCHAPI, FOR GOOGLE IMAGES SEARCH

Google Images API Documentation
GET
 
/api/v1/search?engine=google_images
Download OpenAPI Spec

Google Images API provides a dynamic image search service. It collects image results from various sources globally, categorizes similar images and presents them based on each user's search query. The API provides access to multiple sources for each image, allowing users to choose their topic of interest and select from different publishers' versions of the image. The selection and ranking of images are performed by algorithms that assess factors such as the relevance and quality of the image. It also prioritizes attributes like resolution, source, and freshness. The system is impartial, enabling access to a wide range of images for any search query. Google is continuously improving Images by adding new sources and enhancing its technology, extending its reach to more visual data worldwide.

API Parameters
Search Query
Name
q
Required
Required
Description
This parameter is used for the terms you want to search on Google Images. Queries can include operators and advanced filters like "cute cats", site:, inurl:, intitle:, as_dt, or as_eq.

Device
Name
device
Required
Optional
Description
The default parameter desktop defines the search on a desktop device. The mobile parameter defines the search on a mobile device. The tablet parameter defines the search on a tablet device.

Geographic Location
Name
location
Required
Optional
Description
This parameter is used to specify the canonical location of the search. For exact targeting or to see all available options, check out the Locations API. If multiple locations match your input, the most popular one will be selected.

Name
uule
Required
Optional
Description
This parameter sets the exact Google-encoded location for the search, and uule and location cannot be used at the same time. SearchApi builds it for you when you use the location parameter, but you can provide your own if you want precise control.

Localization
Name
google_domain
Deprecated
Deprecated
Required
Optional
Description
As of Apr 15, 2025, Google began phasing out country code top-level domains (ccTLDs). Users using the search bar or visiting local domains like google.de or google.co.uk are now automatically redirected to google.com. For localized searches, use the gl (country), hl (language) or other localization parameters instead. Learn more in Google's official announcement. See the full list of supported Google domains.

Name
gl
Required
Optional
Description
The default parameter us defines the country of the search. Check the full list of supported Google gl countries.

Name
hl
Required
Optional
Description
The default parameter en defines the interface language of the search. Check the full list of supported Google hl languages.

Name
lr
Required
Optional
Description
The lr parameter restricts search results to documents written in a particular language or a set of languages. The accepted format for this parameter is lang_{2-letter country code}. For instance, to filter documents written in Japanese, the value should be set to lang_jp. To incorporate multiple languages, a value like lang_it|lang_de restricts the search to documents written in either Italian or German. Google identifies the document language based on the top-level domain (TLD) of the document's URL, any language meta tags present, or the language utilized within the document's body text. Check the full list of supported Google lr languages.

Name
cr
Required
Optional
Description
The cr parameter restricts search results to documents originating in a particular country. Google determines the country of a document by the top-level domain (TLD) of the document's URL or by Web server's IP address geographic location. Check the full list of supported Google cr countries.

Filters
Name
nfpr
Required
Optional
Description
This parameter controls whether results from queries that have been auto-corrected for spelling errors are included. To exclude these auto-corrected results, set the value to 1. By default, the value is 0, meaning auto-corrected results are included.

Name
filter
Required
Optional
Description
This parameter controls whether the "Duplicate Content" and "Host Crowding" filters are enabled. Set the value to 1 to enable these filters, which is the default setting. To disable these filters, set the value to 0.

Name
safe
Required
Optional
Description
This parameter toggles the SafeSearch feature for the results. SafeSearch operates by filtering out adult content from your search results. Google's filters use proprietary technology to check keywords, phrases and URLs. While no filters are 100 percent accurate, SafeSearch will remove the overwhelming majority of adult content from your search results. Supported values are active to enable strict SafeSearch, blur to blur explicit images, and off to disable SafeSearch. By default, the value is blur.

Name
tbs
Required
Optional
Description
This parameter restricts results to URLs based on encoded values. Parameter is normally constructed using size, color, image_type, time_period, usage_rights values. For instance, isz:l would return only results that has large image size.

Name
size
Required
Optional
Description
This parameter controls the size of your search results. There are few options available: large, medium, icon, larger_than_400x300, larger_than_640x480, larger_than_800x600, larger_than_1024x768, larger_than_2mp, larger_than_4mp, larger_than_6mp, larger_than_8mp, larger_than_12mp, larger_than_15mp, larger_than_20mp, larger_than_40mp, larger_than_70mp.

Name
time_period
Required
Optional
Description
This parameter restricts results to URLs based on date. Supported values are: last_hour, last_day, last_week, last_month, last_year

Name
color
Required
Optional
Description
This parameter controls the color of your search results. These options are available: black_and_white, color, transparent, red, orange, yellow, green, teal, blue, purple, pink, white, gray, black, brown.

Name
image_type
Required
Optional
Description
This parameter controls the type of your search results. There are only few options that are available: clipart, line_drawing, gif, face, photo.

Name
usage_rights
Required
Optional
Description
This parameter controls the usage rights of your search results. Options that are available: creative_commons_licenses, commercial_or_other_licenses.

Name
aspect_ratio
Required
Optional
Description
This parameter filters images based on aspect ratio. Supported values are:

square - width equals height.
tall - height greater than width.
wide - width greater than height.
panoramic - width is at least twice the height.
Pagination
Name
page
Required
Optional
Description
This parameter indicates which page of results to return. By default, it is set to 1.

Engine
Name
engine
Required
Required
Description
Parameter defines an engine that will be used to retrieve real-time data. It must be set to google_images.

API key
Name
api_key
Required
Required
Description
The api_key authenticates your requests. Use it as a query parameter (https://www.searchapi.io/api/v1/search?api_key=YOUR_API_KEY) or in the Authorization header (Bearer YOUR_API_KEY).

Zero Data Retention
Name
zero_retention
Enterprise Only
Enterprise Only
Required
Optional
Description
Set this parameter to true to disable all logging and persistent storage. No request parameters, HTML, or JSON responses are stored or logged. Suitable for high-compliance use cases. Debugging and support may be limited while enabled.

API Examples
Full Response
Full Response
GET
Open url
https://www.searchapi.io/api/v1/search?api_key=KFmXdcu82EzwVU3sU2BNSna8&engine=google_images&q=apple
Request

Python

requests
import requests

url = "https://www.searchapi.io/api/v1/search"
params = {
  "engine": "google_images",
  "q": "apple",
  "api_key": "KFmXdcu82EzwVU3sU2BNSna8"
}

response = requests.get(url, params=params)
print(response.text)
Copy code
Response
{
  "search_metadata": {
    "id": "search_6EB5K71e3vjbfvQK3vXNW82V",
    "status": "Success",
    "created_at": "2024-11-28T10:55:15Z",
    "request_time_taken": 1.62,
    "parsing_time_taken": 0.04,
    "total_time_taken": 1.66,
    "request_url": "https://www.google.com/search?q=apple&oq=apple&gl=us&hl=en&ie=UTF-8&udm=2",
    "html_url": "https://www.searchapi.io/api/v1/searches/search_6EB5K71e3vjbfvQK3vXNW82V.html",
    "json_url": "https://www.searchapi.io/api/v1/searches/search_6EB5K71e3vjbfvQK3vXNW82V"
  },
  "search_parameters": {
    "engine": "google_images",
    "q": "apple",
    "device": "desktop",
    "hl": "en",
    "gl": "us"
  },
  "search_information": {
    "query_displayed": "apple",
    "detected_location": "Hollywood Hills, Hollywood, FL"
  },
  "suggestions": [
    {
      "title": "Fruit",
      "link": "https://www.google.com/search?sca_esv=4daba4fcecb7e45f&gl=us&hl=en&q=apple+fruit+images&uds=ADvngMjcH0KdF7qGWtwTBrP0nt7dJKTJ99uVgWVcr-vzrAPkVdeCsz9Gnf4fkyJt0_EDA4_G--7Wp9uLFH8uOgQHLiVBa0pdCZ76Vg2qeXcb-jgGMA4ci2y_ho3phKC3Jkc__lG8NMDAzKf0hgrk0pTRK8-qqCLzjw&udm=2&sa=X&ved=2ahUKEwi9o6XX7v6JAxUuVTABHYs4ElgQxKsJegQIDBAB&ictx=0"
    },
    ...
  ],
  "images": [
    {
      "position": 1,
      "title": "Fresh Gala Apple, Each",
      "source": {
        "name": "Walmart",
        "link": "https://www.walmart.com/ip/Fresh-Gala-Apple-Each/44390953"
      },
      "original": {
        "link": "https://i5.walmartimages.com/seo/Fresh-Gala-Apple-Each_f46d4fa7-6108-4450-a610-cc95a1ca28c5_3.38c2c5b2f003a0aafa618f3b4dc3cbbd.jpeg",
        "width": 3000,
        "height": 3000
      },
      "thumbnail": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSjMsDnJRmRWZds5gdgxnLMYb8vuJfPpRUCzA&s"
    },
    ...
  ],
  "related_searches": [
    {
      "link": "https://www.google.com/search?sca_esv=4daba4fcecb7e45f&gl=us&udm=2&hl=en&q=apple+cartoon&stick=H4sIAAAAAAAAAFvEyptYUJCTqpCcWFSSn58HADkdrZwQAAAA&source=univ&sa=X&ved=2ahUKEwi9o6XX7v6JAxUuVTABHYs4ElgQrNwCegQIPRAA",
      "query": "apple cartoon",
      "highlighted": ["cartoon"]
    },
    ...
  ]
}
Images
Images
GET
Open url
https://www.searchapi.io/api/v1/search?api_key=KFmXdcu82EzwVU3sU2BNSna8&engine=google_images&q=panda
Request

Python

requests
import requests

url = "https://www.searchapi.io/api/v1/search"
params = {
  "engine": "google_images",
  "q": "panda",
  "api_key": "KFmXdcu82EzwVU3sU2BNSna8"
}

response = requests.get(url, params=params)
print(response.text)
Copy code
Response
{
  "images": [
    {
      "position": 1,
      "title": "Giant panda - Wikipedia",
      "source": {
        "name": "Wikipedia",
        "link": "https://en.wikipedia.org/wiki/Giant_panda"
      },
      "original": {
        "link": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Grosser_Panda.JPG/640px-Grosser_Panda.JPG",
        "width": 640,
        "height": 427
      },
      "thumbnail": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTcizVg6CO7Hd_xCwzi3buwc7qVN6MnPUciSw&s"
    },
    ...
  ]
}
Suggestions
Suggestions
GET
Open url
https://www.searchapi.io/api/v1/search?api_key=KFmXdcu82EzwVU3sU2BNSna8&engine=google_images&q=Programming+languages
Request

Python

requests
import requests

url = "https://www.searchapi.io/api/v1/search"
params = {
  "engine": "google_images",
  "q": "Programming languages",
  "api_key": "KFmXdcu82EzwVU3sU2BNSna8"
}

response = requests.get(url, params=params)
print(response.text)
Copy code
Response
{
  "suggestions": [
    {
      "title": "Python",
      "link": "https://www.google.com/search?sca_esv=4daba4fcecb7e45f&gl=us&hl=en&q=python+Programming+languages&uds=ADvngMjcH0KdF7qGWtwTBrP0nt7dIqfV1NL4IPLO66CytgxdkuAvSgz7NyA-HyV-nltFo3OlVaEMigXPaRfu3sW9Oy5BBWG9oryPs8yVM3mFGQkfdFEjjlf_zSXPsgeH8NjmgwXYY5ZgNDtHZelOZyDAgFfsUZDax4Ikl4SXWbcnOAj8sp_F2oI&udm=2&sa=X&ved=2ahUKEwj71LKO8f6JAxWArYkEHeifGEcQxKsJegQIDBAB&ictx=0"
    },
    ...
  ],
  ...
}


## USING BING IMAGES INSTEAD OF GOOGLE IAMGES [SAME API PROVIDER:SEARCHAPI]:



Bing Images API Documentation
GET
 
/api/v1/search?engine=bing_images
Download OpenAPI Spec

Bing Images API allows you to retrieve high-quality, up-to-date images and metadata for any search query, enabling you to integrate Bing's powerful image search capabilities directly into your applications.

API Parameters
Search Query
Name
q
Required
Required
Description
This parameter is used for the terms you want to search on Bing Images.

Device
Name
device
Required
Optional
Description
The default parameter desktop defines the search on a desktop device. The mobile parameter defines the search on a mobile device. The tablet parameter defines the search on a tablet device.

Localization
Name
market_code
Required
Optional
Description
Defines the country for search results. Format is language-country, like en-US. For a list of market values, check the full list of supported Bing market_code codes.

Note: the market_code parameter can't be used together with country_code parameter.

Name
country_code
Required
Optional
Description
Specifies the country for the search results if market_code is not specified. Defaults to US if unspecified or market_code is not used. Check the full list of supported Bing coutry_code countries.

Note: the country_code parameter can't be used together with market_code parameter.

Name
language
Required
Optional
Description
Sets the language for user interface text. Use 2-letter (ISO 639-1) or 4-letter codes ('-'). Defaults to en (English) if unspecified or unsupported. Check the full list of supported Bing language languages.

Filters
Name
safe_search
Required
Optional
Description
This parameter toggles the safe_search feature for the results. Default is Moderate. safe_search operates by filtering out adult content from your search results. Options are:

off - returns results with adult text, images, and videos
moderate - returns results with adult text.
strict - don't return results with adult text, images, and videos
Note: In some market_code parameters, strict is enforced regardless of this setting.
Name
size
Required
Optional
Description
This parameter controls the size of your search results. There are few options available: small, medium, large and extra_large.

Name
min_size
Required
Optional
Description
Use this parameter to filter images by minimum width and height. Enter the size in the format WidthxHeight (e.g., 800x600).

Name
time_period
Required
Optional
Description
This parameter restricts results to URLs based on date. Supported values are: last_day, last_week, last_month, last_year.

Name
color
Required
Optional
Description
This parameter controls the color of your search results. These options are available: black_and_white, color, red, orange, yellow, green, teal, blue, purple, pink, brown, black, gray,white.

Name
image_type
Required
Optional
Description
This parameter controls the type of your search results. There are only few options that are available: photo, gif, clipart, line_drawing, transparent, face and head_and_shoulders.

Name
usage_rights
Required
Optional
Description
This parameter controls the usage rights of your search results. Options that are available: public_domain, creative_commons_licenses, free_to_share_and_use, free_to_share_and_use_commercial, free_to_modify_share_and_use, free_to_modify_share_and_use_commercial.

Name
aspect_ratio
Required
Optional
Description
This parameter filters images based on aspect ratio. Supported values are:

square - width equals height.
tall - height greater than width.
wide - width greater than height.
Pagination
Name
page
Required
Optional
Description
This parameter indicates which page of results to return. By default, it is set to 1.

Engine
Name
engine
Required
Required
Description
Parameter defines an engine that will be used to retrieve real-time data. It must be set to bing_images.

API key
Name
api_key
Required
Required
Description
The api_key authenticates your requests. Use it as a query parameter (https://www.searchapi.io/api/v1/search?api_key=YOUR_API_KEY) or in the Authorization header (Bearer YOUR_API_KEY).

Zero Data Retention
Name
zero_retention
Enterprise Only
Enterprise Only
Required
Optional
Description
Set this parameter to true to disable all logging and persistent storage. No request parameters, HTML, or JSON responses are stored or logged. Suitable for high-compliance use cases. Debugging and support may be limited while enabled.

API Examples
Full Response
Full Response
GET
Open url
https://www.searchapi.io/api/v1/search?api_key=KFmXdcu82EzwVU3sU2BNSna8&engine=bing_images&q=grape
Request

Python

requests
import requests

url = "https://www.searchapi.io/api/v1/search"
params = {
  "engine": "bing_images",
  "q": "grape",
  "api_key": "KFmXdcu82EzwVU3sU2BNSna8"
}

response = requests.get(url, params=params)
print(response.text)
Copy code
Response
{
    "search_metadata": {
        "id": "search_vr7K8ndWgWe1idN83P45k2mY",
        "status": "Success",
        "created_at": "2025-08-11T18:35:51Z",
        "request_time_taken": 1.3,
        "parsing_time_taken": 0.1,
        "total_time_taken": 1.4,
        "request_url": "https://www.bing.com/images/search?q=grape&mkt=en-us&first=1",
        "html_url": "https://www.searchapi.io/api/v1/searches/search_vr7K8ndWgWe1idN83P45k2mY.html",
        "json_url": "https://www.searchapi.io/api/v1/searches/search_vr7K8ndWgWe1idN83P45k2mY"
    },
    "search_parameters": {
        "engine": "bing_images",
        "q": "grape",
        "device": "desktop"
    },
    "search_information": {
        "query_displayed": "grape"
    },
    "suggestions": [
        {
            "title": "Grapes Clip Art",
            "link": "https://www.bing.com/images/search?q=Grapes+Clip+Art&FORM=RESTAB",
            "thumbnail": "https://thfvnext.bing.com/th?q=Grapes+Clip+Art&w=42&h=42&c=7&rs=1&p=0&o=5&cb=thfvnext&pid=1.7&mkt=en-US&cc=US&setlang=en&adlt=moderate&t=1"
        },
        ...
    ],
    "images": [
        {
            "position": 1,
            "title": "The meaning and symbolism of the word - «Grapes»",
            "source": {
                "name": "weknowyourdreams.com",
                "link": "http://weknowyourdreams.com/grapes.html"
            },
            "original": {
                "link": "https://th.bing.com/th/id/R.28d1c9dd98f97cca56a351e1b3deee0f?rik=V9vVsHbOOViWVw&riu=http%3a%2f%2fweknowyourdreams.com%2fimages%2fgrapes%2fgrapes-02.jpg&ehk=gW7u0v1vlYi%2fWLser9zzkJpw2W4BofaSRK4XfrJ3weI%3d&risl=1&pid=ImgRaw&r=0",
                "width": "474",
                "height": "379"
            },
            "thumbnail": "https://thfvnext.bing.com/th/id/OIP.KNHJ3Zj5fMpWo1Hhs97uDwAAAA?w=249&h=199&c=7&r=0&o=5&cb=thfvnext&pid=1.7"
        },
        ...
    ],
    "related_searches": [
        {
            "query": "Grape Seed Oil",
            "link": "https://www.bing.com/images/search?q=Grape+Seed+Oil&qft=&fsm=1&FORM=SHOPSO",
            "thumbnail": "https://thfvnext.bing.com/th?q=Grape+Seed+Oil&w=180&h=52&c=1&rs=1&qlt=90&cb=thfvnext&pid=InlineBlock&mkt=en-US&cc=US&setlang=en&adlt=moderate&t=1"
        },
        ...
    ]
}
Images
Images
GET
Open url
https://www.searchapi.io/api/v1/search?api_key=KFmXdcu82EzwVU3sU2BNSna8&engine=bing_images&q=pineapple
Request

Python

requests
import requests

url = "https://www.searchapi.io/api/v1/search"
params = {
  "engine": "bing_images",
  "q": "pineapple",
  "api_key": "KFmXdcu82EzwVU3sU2BNSna8"
}

response = requests.get(url, params=params)
print(response.text)
Copy code
Response
{
    "images": [
        {
            "position": 1,
            "title": "Pineapple 101: Benefits, Buying, And Storing Pineapple",
            "source": {
                "name": "liveeatlearn.com",
                "link": "https://www.liveeatlearn.com/pineapple/"
            },
            "original": {
                "link": "https://www.liveeatlearn.com/wp-content/uploads/2023/05/How-to-Cut-Pineapple-01.jpg",
                "width": "1200",
                "height": "1800"
            },
            "thumbnail": "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAEALAAAAAABAAEAAAIBTAA7"
        },
        {
            "position": 2,
            "title": "The meaning and symbolism of the word - «Pineapple»",
            "source": {
                "name": "weknowyourdreams.com",
                "link": "http://weknowyourdreams.com/pineapple.html"
            },
            "original": {
                "link": "https://th.bing.com/th/id/R.38c93f5f147cd00f38a488b7cd7a50ad?rik=%2bSa%2bOIG8GnzYKQ&riu=http%3a%2f%2fweknowyourdreams.com%2fimages%2fpineapple%2fpineapple-08.jpg&ehk=KV9%2fnGjs5ZfzkUUPF1FA6rtEWUtocGJ0iN2UhsO8fXg%3d&risl=&pid=ImgRaw&r=0",
                "width": "3944",
                "height": "5116"
            },
            "thumbnail": "https://tse1.mm.bing.net/th/id/ODF.IQxLp9fVDj55WcjZYEIDjQ?w=12&h=12&c=7&rs=1&p=0&pid=1.7"
        },
        ...
    ]
}
Suggestions
Suggestions
GET
Open url
https://www.searchapi.io/api/v1/search?api_key=KFmXdcu82EzwVU3sU2BNSna8&engine=bing_images&q=strawberry
Request

Python

requests
import requests

url = "https://www.searchapi.io/api/v1/search"
params = {
  "engine": "bing_images",
  "q": "strawberry",
  "api_key": "KFmXdcu82EzwVU3sU2BNSna8"
}

response = requests.get(url, params=params)
print(response.text)
Copy code
Response
{
    "suggestions": [
        {
            "title": "Fruits",
            "link": "https://www.bing.com/images/search?q=Fruits&FORM=RESTAB",
            "thumbnail": "https://tse2.mm.bing.net/th?q=Fruits&w=42&h=42&c=7&rs=1&p=0&o=5&pid=1.7&mkt=en-US&cc=US&setlang=en&adlt=moderate&t=1"
        },
        {
            "title": "Real Strawberry",
            "link": "https://www.bing.com/images/search?q=Real+Strawberry&FORM=RESTAB",
            "thumbnail": "https://tse4.mm.bing.net/th?q=Real+Strawberry&w=42&h=42&c=7&rs=1&p=0&o=5&pid=1.7&mkt=en-US&cc=US&setlang=en&adlt=moderate&t=1"
        },
        ...
    ]
}
Shopping Ads
Shopping Ads 
GET
Open url
https://www.searchapi.io/api/v1/search?api_key=KFmXdcu82EzwVU3sU2BNSna8&device=mobile&engine=bing_images&q=iphone+15
Request

Python

requests
import requests

url = "https://www.searchapi.io/api/v1/search"
params = {
  "engine": "bing_images",
  "q": "iphone 15",
  "device": "mobile",
  "api_key": "KFmXdcu82EzwVU3sU2BNSna8"
}

response = requests.get(url, params=params)
print(response.text)
Copy code
Response
{
    "shopping_ads": [
        {
            "position": 1,
            "title": "Apple iPhone 16 - 512GB - Pink - AT&T",
            "seller": "AT&T",
            "link": "https://d.agkn.com/pixel/4102/?che=",
            "price": "$0.00 now",
            "extracted_price": 0,
            "installment": {
                "down_payment": "$0.00 now",
                "extracted_down_payment": 0,
                "months": "36",
                "extracted_months": 36,
                "cost_per_month": "$31.39",
                "extracted_cost_per_month": 31.39
            },
            "image": "https://thf.bing.com/th?id=OPHS.6Nso2LrBHf%2fNPw474C474&w=140&h=140&rs=1&r=0&o=5&pid=21.1"
        },
        ...
    ]
}