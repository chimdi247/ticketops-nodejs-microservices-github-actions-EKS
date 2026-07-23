terraform {
  backend "s3" {
    bucket = "ticketops-terraform-state-chimdi"
    region = "eu-west-2"
    encrypt = true
    key = "dev/terraform.tfstate"
    use_lockfile = true
  }

  required_providers {
    aws = {
        source = "hashicorp/aws"
        version = "~> 5.0"
    }

  }
  required_version = ">= 1.6.0"




}

 provider "aws"{
    region = "eu-west-2"
    default_tags {
      tags = {
         Project     = "ticketops"
      Environment = "dev"
      ManagedBy   = "terraform"
      }
    }
  }
